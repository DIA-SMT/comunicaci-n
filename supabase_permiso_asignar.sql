-- Permiso para repartir responsables entre los miembros del área.
--
-- Hasta ahora, el campo "Responsables" de una tarea lo podía tocar cualquiera que
-- entrara a "Editar Tarea". A partir de este cambio, solo lo puede modificar quien
-- tenga `profiles.puede_asignar = true`. Es un permiso aparte de `role`: un admin
-- sin este permiso sigue creando proyectos, cambiando prioridades, editando fechas
-- y finalizando proyectos; lo único que pierde es repartir el trabajo.
--
-- IMPORTANTE: ejecutar esto en el SQL Editor de Supabase ANTES de desplegar la app.
-- Si se despliega primero, la columna todavía no existe y nadie —Marcos incluido—
-- puede asignar hasta que se corra este script.

-- 1) Columna nueva. Por defecto nadie puede asignar.
alter table public.profiles
    add column if not exists puede_asignar boolean not null default false;

-- 2) Habilitar únicamente a Marcos Gomez.
update public.profiles
set puede_asignar = true
where id = '0ac8c87a-5d02-4a8f-a8e1-43894171cf09';

-- 3) Verificación: tiene que devolver exactamente una fila, la de Marcos Gomez.
select id, full_name, role, puede_asignar
from public.profiles
where puede_asignar = true;


-- ---------------------------------------------------------------------------
-- Para sumar a alguien más en el futuro (sin tocar código):
--
--   update public.profiles set puede_asignar = true
--   where full_name = 'Nombre Apellido';
--
-- Para quitarle el permiso a alguien:
--
--   update public.profiles set puede_asignar = false
--   where full_name = 'Nombre Apellido';
--
-- El usuario tiene que cerrar sesión y volver a entrar para que el cambio
-- le aparezca en la pantalla.
-- ---------------------------------------------------------------------------
