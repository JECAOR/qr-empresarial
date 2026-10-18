-- Migracion 014: ultimo acceso de cada cuenta (RF-13, modulo 8).
--
-- El RF-13 pide que el administrador pueda consultar "la cantidad de usuarios
-- registrados y SU ACTIVIDAD". Casi toda esa actividad ya se puede calcular
-- con lo que hay: si la cuenta tiene perfil, cuantos bloques publico, si su
-- codigo QR esta encendido y cuantos escaneos, visitas y clics acumula la
-- tabla `evento`.
--
-- Lo unico que no se podia saber era cuando entro por ultima vez, y es el
-- dato mas util de todos para el RF-14: "eliminar usuarios INACTIVOS" no se
-- puede decidir sin saber quien lleva meses sin entrar. La tabla `usuario`
-- guardaba la fecha de registro, el estado, el rol y desde cuando valen sus
-- sesiones, y ninguna de las cuatro sirve para eso.
--
-- Se escribe en cada inicio de sesion. Es NULL mientras la cuenta no haya
-- entrado nunca, que es informacion en si misma: una cuenta registrada que
-- jamas volvio.
USE qr_empresarial;

ALTER TABLE usuario
  ADD COLUMN ultimo_acceso DATETIME NULL DEFAULT NULL
    COMMENT 'Ultimo inicio de sesion correcto; NULL si nunca entro'
    AFTER fecha_registro;

-- La lista de administracion ordena por esta columna para encontrar las
-- cuentas inactivas, que es su caso de uso principal
CREATE INDEX idx_usuario_ultimo_acceso ON usuario (ultimo_acceso);
