## Barrido
- Modo: inventario de bodega ENCENDIDO (inventario_bodega). Rol del barrido: qa-admin (ve todas las pantallas). Si hay casos, hazlos primero; luego cierra sesion y entra como qa-admin.
- Excluir: /entradas/identificar (llama a un servicio externo de IA)
- Excluir elementos: Tomar o subir foto, Cambiar foto, Eliminar foto, Guardar conteo, Guardar cambios, Crear producto (boton de envio), Crear usuario, ACTUALIZAR (compras)
- No guardar ni crear datos: abrir formularios, escribir en cada campo de texto y elegir opciones de cada selector SIN enviar, y volver.
- El encabezado (buscador "Buscar producto por código, alias o descripción", boton Buscar, selector "Estoy contando en", enlace "A Arjun", "Cerrar sesión") se repite en cada pantalla: en CADA pantalla registra una fila por cada uno (escribir/elegir/clic rapido). "Cerrar sesión": hazlo una sola vez al final y registra en las demas pantallas que esta visible.
- /login: probar Usuario, Contraseña e Ingresar al volver a entrar.
- Botones excluidos igual se registran como "excluido (no se envia)" en la tabla.
- Capacidades esperadas (del PRD; cada una debe tener un control visible y funcionar):
  1. Inicio con buscador grande por codigo, codigo personal o descripcion; acceso a "Ver todo el inventario" y a "Identificar por foto"
  2. Seccion Compras en el inicio con boton ACTUALIZAR y fecha de ultima actualizacion
  3. Lista de inventario con Imagen, Codigo, Ubicacion y Stock; paginacion "Ver más"
  4. "Mostrar valores" (solo admin) agrega Costo prom. y Valor y el total "Inversión según últimos conteos"
  5. Ficha de producto: buscador para abrir otro producto, imagen, formulario de conteo con bodega/planta/pasillo/posicion y cantidad, historial de conteos, compras, valorizacion (admin) y edicion de codigo personal/packing/observaciones
  6. Volver desde la ficha conserva busqueda, pagina y valores
  7. Crear producto manual (formulario visible)
  8. Usuarios: el administrador puede ver la lista y el formulario
  9. Rutas antiguas (/movimientos, /bodegas, /modulos, /salidas, /retornos, /transferencias, /inversion-mercaderia) llevan a Inventario
  10. Cerrar sesion
