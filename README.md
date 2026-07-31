# D’2A2 — paquete para Netlify

D’2A2 es una aplicación web para conducir sesiones de feedback 1:1. Este paquete incluye la interfaz, generación directa de PDF, dictado continuo, autenticación, almacenamiento privado por cuenta y la configuración necesaria para Netlify.

## Publicación recomendada (sin usar la terminal)

El ZIP contiene **código fuente**, funciones privadas y una migración de base de datos. Para que Netlify instale y ejecute todo correctamente, no publiques únicamente la carpeta `dist` mediante Netlify Drop.

1. Descomprime `D2A2_Netlify.zip`.
2. Crea un repositorio nuevo en GitHub y, desde la interfaz web de GitHub, carga todo el contenido descomprimido. `index.html` debe quedar en la raíz del repositorio.
3. En Netlify elige **Add new project → Import an existing project** y conecta ese repositorio.
4. Netlify leerá `netlify.toml` automáticamente. Confirma estos valores si los solicita:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Publica el proyecto.
6. En la configuración del proyecto de Netlify, abre **Identity** y actívalo.
7. Para un primer piloto, configura el registro como **solo por invitación** y mantén activa la confirmación por correo. Después invita a las personas que usarán la aplicación.
8. Comprueba en la sección **Database** que la base de datos quedó creada. La migración `netlify/database/migrations/202607310001_create_sessions.sql` crea la tabla privada de sesiones durante el despliegue. Si Netlify no la aprovisiona automáticamente, crea una Netlify Database desde el panel y vuelve a desplegar.
9. Abre la URL HTTPS generada por Netlify, registra o invita una cuenta y crea una sesión de prueba.

Cada consulta del backend verifica la identidad y filtra las sesiones por el identificador de la cuenta. Un usuario no puede solicitar las sesiones de otra cuenta a través de la interfaz ni de la función.

## Primera entrada y sesiones existentes

Si el navegador ya contiene sesiones creadas con una versión local anterior, D’2A2 mostrará una decisión única después del primer inicio de sesión:

- **Importar a mi cuenta**: copia esas sesiones al espacio privado del usuario.
- **Ahora no**: conserva una copia pendiente en ese navegador para decidirlo después.

Al cerrar sesión, la caché local visible de esa cuenta se limpia. Los datos privados permanecen en la base de datos y vuelven a cargarse tras el siguiente inicio de sesión.

## Funciones incluidas

- Registro, inicio y cierre de sesión, confirmación por correo y recuperación de contraseña.
- Sesiones privadas por usuario con sincronización y detección de cambios simultáneos.
- Preparación previa de la sesión antes de iniciar el cronómetro.
- Diseño responsive probado desde 320 px, con encabezado reorganizado, controles táctiles y agenda móvil desplazable.
- Modo conversación enfocado, con un bloque y una pregunta principal a la vez.
- Cronómetro flotante, inicio automático por paso, pausa, reinicio y `+2 min`.
- Dictado continuo español/inglés, transcripción completa y resumen local sin IA.
- Estacionamiento de temas con decisiones **Hablar ahora** o **Posponer**.
- Compromisos rápidos, checklist de cierre y separación de notas privadas.
- Archivo de sesiones con restauración y eliminación permanente controlada.
- PDF compartible y PDF privado descargados directamente, con membrete D’2A2.
- Migración segura desde el almacenamiento local anterior.
- Eliminación de todas las sesiones de una cuenta desde el menú de usuario.

## Estructura principal

```text
index.html                         Aplicación y estilos principales
src/cloud.js                       Login, migración y sincronización
public/vendor/pdf-lib.min.js       Generación local de PDF
netlify/functions/sessions.mjs     API privada de sesiones
netlify/functions/account-data.mjs Eliminación privada de datos
netlify/database/migrations/       Esquema de base de datos
netlify.toml                       Build, rutas y cabeceras de seguridad
tests/                             Pruebas funcionales automatizadas
```

## Desarrollo opcional

Solo si un desarrollador necesita modificar o verificar el proyecto localmente:

```bash
npm install
npm test
npm run build
```

Para revisar únicamente la interfaz sin una cuenta, el acceso local ofrece **Continuar en modo local**. Esa opción no aparece en el sitio publicado.

## Privacidad y límites

- El dictado depende de la API de reconocimiento de voz del navegador. Chrome y Edge suelen ofrecer la mejor compatibilidad; el navegador puede procesar el audio mediante su propio servicio de voz.
- El resumen sin IA es extractivo: selecciona frases relevantes de la transcripción y permite elegir entre transcripción completa o resumen antes de guardar.
- Este proyecto evita colocar contraseñas o credenciales dentro del HTML. La sesión autenticada se administra mediante Netlify Identity y las funciones validan al usuario en el servidor.
- Para información sensible de recursos humanos, revisa las políticas de retención, copias de seguridad y tratamiento de datos de tu organización antes de un lanzamiento amplio.

Documentación oficial: [Netlify Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/), [Netlify Functions](https://docs.netlify.com/build/functions/overview/) y [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/).
