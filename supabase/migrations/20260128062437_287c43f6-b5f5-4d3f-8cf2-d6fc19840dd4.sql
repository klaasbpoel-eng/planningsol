-- Create products table for gas cylinder articles
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    article_code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    category text,
    size_liters numeric,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view active products" 
ON public.products 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can view all products" 
ON public.products 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Admins can create products" 
ON public.products 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update products" 
ON public.products 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete products" 
ON public.products 
FOR DELETE 
USING (is_admin());

-- Create orders table for internal orders
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL UNIQUE,
    customer_id uuid REFERENCES public.customers(id),
    customer_name text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    notes text,
    delivery_date date,
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create policies for orders
CREATE POLICY "Admins can view all orders" 
ON public.orders 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Users can view own orders" 
ON public.orders 
FOR SELECT 
USING (created_by IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can create orders" 
ON public.orders 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update orders" 
ON public.orders 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete orders" 
ON public.orders 
FOR DELETE 
USING (is_admin());

-- Create order_items table
CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id),
    article_code text NOT NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for order_items (inherit from orders)
CREATE POLICY "Admins can view all order items" 
ON public.order_items 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Users can view own order items" 
ON public.order_items 
FOR SELECT 
USING (order_id IN (
    SELECT id FROM orders WHERE created_by IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
    )
));

CREATE POLICY "Admins can create order items" 
ON public.order_items 
FOR INSERT 
WITH CHECK (is_admin());

CREATE POLICY "Admins can update order items" 
ON public.order_items 
FOR UPDATE 
USING (is_admin());

CREATE POLICY "Admins can delete order items" 
ON public.order_items 
FOR DELETE 
USING (is_admin());

-- Create customer_products junction table for tracking which products each customer typically orders
CREATE TABLE public.customer_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    warehouse text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(customer_id, product_id)
);

-- Enable RLS on customer_products
ALTER TABLE public.customer_products ENABLE ROW LEVEL SECURITY;

-- Create policies for customer_products
CREATE POLICY "Authenticated users can view customer products" 
ON public.customer_products 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage customer products" 
ON public.customer_products 
FOR ALL 
USING (is_admin());

-- Create updated_at triggers
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();