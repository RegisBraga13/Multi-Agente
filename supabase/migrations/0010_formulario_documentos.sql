-- O formulário também recebe receitas anteriores, exames e laudos (foto ou PDF), além das fotos da pele.
alter table public.booking_form_photos drop constraint booking_form_photos_content_type_check;
alter table public.booking_form_photos add constraint booking_form_photos_content_type_check
  check (content_type ~ '^image/[a-z0-9.+-]+$' or content_type = 'application/pdf');
