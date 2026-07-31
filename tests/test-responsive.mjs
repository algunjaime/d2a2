import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';

assert.match(html, /viewport-fit=cover/, 'Falta soporte para las áreas seguras de dispositivos móviles.');
assert.match(html, /class="header-session-actions"/, 'Las acciones contextuales no están agrupadas en el encabezado.');
assert.match(html, /class="rail-list"/, 'La agenda no tiene el contenedor responsive esperado.');
assert.match(html, /class="stage-nav-actions"/, 'Las acciones finales del bloque no tienen agrupación responsive.');
assert.match(css, /@media\(max-width:650px\)/, 'Falta el punto de adaptación móvil principal.');
assert.match(css, /\.topbar\{grid-template-columns:minmax\(0,1fr\)/, 'El encabezado no cambia a una sola columna en móvil.');
assert.match(css, /\.rail-list\{display:flex;[^}]*overflow-x:auto/, 'La agenda móvil no permite desplazamiento horizontal.');
assert.match(css, /\.btn\{min-height:44px\}/, 'Los botones móviles no conservan un objetivo táctil suficiente.');
assert.match(css, /input::placeholder\{color:#C7D3E5;opacity:1\}/, 'El placeholder de los campos oscuros perdió su contraste.');
assert.match(css, /select option,select optgroup\{\s*background:var\(--paper\);\s*color:var\(--ink\)/, 'Las opciones nativas no tienen colores explícitos de alto contraste.');
assert.match(css, /\.meta-field input\[type=date\]\{[^}]*inline-size:100%[^}]*-webkit-appearance:none[^}]*text-align:left/, 'El campo de fecha no conserva un ancho y alineación compatibles con Safari móvil.');
assert.match(css, /\.summary-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, 'Las acciones del resumen no se reorganizan en dos columnas en móvil.');
assert.match(css, /@media\(max-width:350px\)[\s\S]*\.summary-actions\{grid-template-columns:1fr\}/, 'Las acciones del resumen no se apilan en móviles estrechos.');
assert.match(css, /\.action-cards\{\s*display:grid;grid-template-columns:repeat\(auto-fill,minmax\(126px,1fr\)\)/, 'Las tarjetas de acción no conservan su cuadrícula adaptable.');
assert.match(css, /\.action-choice\{[^}]*aspect-ratio:5\/6[^}]*flex-direction:column/, 'Las acciones no se muestran como tarjetas verticales.');
for (const message of ['¡Sigamos así!', "Let's Go!", 'No más de esto', 'Help me!', 'Párame Bolas', 'Quiero Entender', 'Voy a Soltar', 'Esto es Urgente', 'Lo Acepto', '¡Apóyame!', 'Solucionemos', '¡Probemos!', '¡Yo Puedo!']) {
  assert.ok(html.includes(message), `Falta el mensaje de tarjeta: ${message}`);
}

console.log('OK: estructura responsive, controles táctiles y reglas críticas de contraste verificadas.');
