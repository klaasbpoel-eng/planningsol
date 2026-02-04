-- Create internal_orders table
CREATE TABLE public.internal_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number text NOT NULL UNIQUE,
    from_location production_location NOT NULL,
    to_location production_location NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'received')),
    notes text,
    created_by uuid REFERENCES public.profiles(id) NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create internal_order_items table
CREATE TABLE public.internal_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.internal_orders(id) ON DELETE CASCADE NOT NULL,
    article_id text NOT NULL,
    article_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_order_items ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger for internal_orders
CREATE TRIGGER update_internal_orders_updated_at
    BEFORE UPDATE ON public.internal_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for internal_orders

-- SELECT: Elevated roles can view orders for their location or all if no location set
CREATE POLICY "Admins can view all internal orders"
    ON public.internal_orders FOR SELECT
    USING (is_admin());

CREATE POLICY "Supervisors can view internal orders for their location"
    ON public.internal_orders FOR SELECT
    USING (
        has_role(auth.uid(), 'supervisor') AND (
            (get_user_production_location(auth.uid()) IS NOT NULL AND 
             (from_location = get_user_production_location(auth.uid()) OR 
              to_location = get_user_production_location(auth.uid())))
            OR get_user_production_location(auth.uid()) IS NULL
        )
    );

CREATE POLICY "Operators can view internal orders for their location"
    ON public.internal_orders FOR SELECT
    USING (
        has_role(auth.uid(), 'operator') AND (
            (get_user_production_location(auth.uid()) IS NOT NULL AND 
             (from_location = get_user_production_location(auth.uid()) OR 
              to_location = get_user_production_location(auth.uid())))
            OR get_user_production_location(auth.uid()) IS NULL
        )
    );

-- INSERT: Admins and Supervisors can create orders
CREATE POLICY "Admins can create internal orders"
    ON public.internal_orders FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY "Supervisors can create internal orders"
    ON public.internal_orders FOR INSERT
    WITH CHECK (has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Operators can create internal orders"
    ON public.internal_orders FOR INSERT
    WITH CHECK (has_role(auth.uid(), 'operator'));

-- UPDATE: Admins and Supervisors can update orders
CREATE POLICY "Admins can update internal orders"
    ON public.internal_orders FOR UPDATE
    USING (is_admin());

CREATE POLICY "Supervisors can update internal orders for their location"
    ON public.internal_orders FOR UPDATE
    USING (
        has_role(auth.uid(), 'supervisor') AND (
            (get_user_production_location(auth.uid()) IS NOT NULL AND 
             (from_location = get_user_production_location(auth.uid()) OR 
              to_location = get_user_production_location(auth.uid())))
            OR get_user_production_location(auth.uid()) IS NULL
        )
    );

-- DELETE: Only admins can delete
CREATE POLICY "Admins can delete internal orders"
    ON public.internal_orders FOR DELETE
    USING (is_admin());

-- RLS Policies for internal_order_items (inherit from parent order access)

CREATE POLICY "Users can view internal order items if they can view the order"
    ON public.internal_order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.internal_orders o
            WHERE o.id = order_id
        )
    );

CREATE POLICY "Users can create internal order items if they can create orders"
    ON public.internal_order_items FOR INSERT
    WITH CHECK (
        is_admin() OR has_role(auth.uid(), 'supervisor') OR has_role(auth.uid(), 'operator')
    );

CREATE POLICY "Admins can update internal order items"
    ON public.internal_order_items FOR UPDATE
    USING (is_admin());

CREATE POLICY "Admins can delete internal order items"
    ON public.internal_order_items FOR DELETE
    USING (is_admin());

-- Create indexes for better query performance
CREATE INDEX idx_internal_orders_from_location ON public.internal_orders(from_location);
CREATE INDEX idx_internal_orders_to_location ON public.internal_orders(to_location);
CREATE INDEX idx_internal_orders_status ON public.internal_orders(status);
CREATE INDEX idx_internal_orders_created_at ON public.internal_orders(created_at DESC);
CREATE INDEX idx_internal_order_items_order_id ON public.internal_order_items(order_id);