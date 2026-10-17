import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const name of ['index.html', 'app.js', 'styles.css']) await copyFile(name, `dist/${name}`);
console.log('Demo preparada en dist/.');
