-- Create app_role enum for role-based access control
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  pin_hash VARCHAR(255) NOT NULL,
  payment_id VARCHAR(20) NOT NULL UNIQUE,
  device_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(12, 2) DEFAULT 0.00 NOT NULL CHECK (balance >= 0),
  offline_daily_limit DECIMAL(12, 2) DEFAULT 5000.00 NOT NULL,
  offline_used_today DECIMAL(12, 2) DEFAULT 0.00 NOT NULL,
  last_offline_reset DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create transaction_status enum
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  status transaction_status DEFAULT 'pending' NOT NULL,
  description VARCHAR(255),
  transaction_hash VARCHAR(64),
  device_id VARCHAR(255),
  is_offline BOOLEAN DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE,
  fraud_flagged BOOLEAN DEFAULT false,
  fraud_reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_profiles_payment_id ON public.profiles(payment_id);
CREATE INDEX idx_transactions_sender ON public.transactions(sender_id);
CREATE INDEX idx_transactions_receiver ON public.transactions(receiver_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to reset daily offline limit
CREATE OR REPLACE FUNCTION public.reset_daily_offline_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_offline_reset < CURRENT_DATE THEN
    NEW.offline_used_today = 0;
    NEW.last_offline_reset = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER reset_wallet_daily_limit
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.reset_daily_offline_limit();

-- Function to generate unique payment ID
CREATE OR REPLACE FUNCTION public.generate_payment_id()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_id VARCHAR(20);
  prefix VARCHAR(3) := 'OP';
BEGIN
  LOOP
    new_id := prefix || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE payment_id = new_id);
  END LOOP;
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to create profile and wallet on signup (called via trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Note: Profile and wallet creation will be handled by the application
  -- since we need the phone and PIN from the signup flow
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for wallets
CREATE POLICY "Users can view their own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
  ON public.wallets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wallet"
  ON public.wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets"
  ON public.wallets FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for transactions
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert transactions as sender"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their pending transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = sender_id AND status = 'pending');

CREATE POLICY "Admins can view all transactions"
  ON public.transactions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any transaction"
  ON public.transactions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to get profile by payment_id (for QR/ID payments)
CREATE OR REPLACE FUNCTION public.get_profile_by_payment_id(_payment_id VARCHAR)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  display_name VARCHAR,
  payment_id VARCHAR
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.display_name, p.payment_id
  FROM public.profiles p
  WHERE p.payment_id = _payment_id
  AND p.is_active = true
$$;

-- Function to process transaction (for atomic balance updates)
CREATE OR REPLACE FUNCTION public.process_transaction(
  _sender_id UUID,
  _receiver_id UUID,
  _amount DECIMAL,
  _description VARCHAR DEFAULT NULL,
  _is_offline BOOLEAN DEFAULT false,
  _transaction_hash VARCHAR DEFAULT NULL,
  _device_id VARCHAR DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _transaction_id UUID;
  _sender_balance DECIMAL;
BEGIN
  -- Check sender balance
  SELECT balance INTO _sender_balance FROM public.wallets WHERE user_id = _sender_id FOR UPDATE;
  
  IF _sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;
  
  IF _sender_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct from sender
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = _sender_id;
  
  -- Add to receiver
  UPDATE public.wallets SET balance = balance + _amount WHERE user_id = _receiver_id;
  
  -- Create transaction record
  INSERT INTO public.transactions (
    sender_id, receiver_id, amount, status, description, 
    is_offline, transaction_hash, device_id, synced_at
  )
  VALUES (
    _sender_id, _receiver_id, _amount, 'completed', _description,
    _is_offline, _transaction_hash, _device_id, 
    CASE WHEN _is_offline THEN now() ELSE NULL END
  )
  RETURNING id INTO _transaction_id;
  
  RETURN _transaction_id;
END;
$$;