# Enlace — Prototipo de traslados

Demo en HTML, CSS y JavaScript para coordinar pacientes y acompañantes entre las ciudades A y B.

## Funciones

- Un administrador gestiona las dos ciudades.
- Confirma si cada paciente viaja solo o acompañado antes de partir.
- Registra regresos, hospitalizaciones y acompañantes que permanecen en B.
- Calcula unidades de 16 pasajeros, incluyendo regresos pendientes de días anteriores.
- La recomendación se actualiza con los datos del navegador.
- Busca, filtra y exporta los registros a CSV.

## GitHub Pages

El sitio está preparado para publicarse desde la rama main, carpeta raíz (/).

En Settings > Pages, selecciona Deploy from a branch, main y /(root).

La dirección esperada al completar la publicación es https://pinkylalin.github.io/Prototipo/.

## Ejecutar localmente

No requiere instalar dependencias. Con Node.js instalado:

```sh
npm run dev
```

Abre http://localhost:3000. Para detenerlo, pulsa Ctrl+C en la terminal. También puedes abrir index.html directamente.

## Archivos principales

- app.js: lógica, estados, almacenamiento y cálculo de unidades.
- styles.css: diseño en blanco, negro y grises.
- index.html: estructura de las pantallas.
- server.mjs: servidor local.

## Datos de demostración

El acceso es simulado y los datos iniciales son ficticios. Los cambios se guardan en localStorage: cada navegador tiene sus propios datos. Compartir la URL no sincroniza registros entre computadoras.

## Comprobaciones

```sh
npm test
npm run build
```