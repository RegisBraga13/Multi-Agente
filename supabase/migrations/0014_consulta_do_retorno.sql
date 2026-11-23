-- Retorno: a consulta de retorno nasce do cartão "Retorno" da agenda (uma vez só, por isso único).
alter table public.encounters add column return_booking_id uuid unique references public.return_bookings(id);
