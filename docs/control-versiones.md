# Control de versiones — QR Empresarial

Descripción del proceso de instalación y configuración de Git (local) y GitHub (web) para el proyecto.
Evidencia GA7-220501096-AA1-EV04.

- **Repositorio remoto:** https://github.com/JECAOR/qr-empresarial (privado)
- **Repositorio local:** `Escritorio/qr-empresarial`
- **Herramientas:** Git 2.56.0 para Windows (Git Bash) y GitHub CLI 2.100.0
- **Fecha:** 28 de septiembre de 2026

## 1. Instalación y configuración

Git se instaló desde [git-scm.com](https://git-scm.com) con la opción Git Bash. Luego se configuraron el autor de los commits y la rama por defecto:

```bash
git --version
git config --global user.name "Jean Carlos Orozco Hernández"
git config --global user.email "jeanorozco@gmail.com"
git config --global init.defaultBranch main
git config --global --list
```

## 2. Repositorio local

```bash
git init                 # crea el repositorio
git status               # muestra los archivos sin seguimiento
git add README.md .gitignore .editorconfig
git commit -m "chore: inicializa el repositorio con README, .gitignore y .editorconfig"
git add frontend
git commit -m "feat(frontend): agrega las 11 pantallas, estilos, scripts y pruebas Playwright"
git add database backend docs
git commit -m "feat(database): agrega el esquema qr_empresarial y la estructura de backend y docs"
```

## 3. Repositorio remoto y conexión

```bash
gh repo create qr-empresarial --private --description "QR Empresarial ..."
git remote add origin https://github.com/JECAOR/qr-empresarial.git
git remote -v
```

## 4. Envío y actualización

```bash
git push -u origin main      # sube los commits y enlaza la rama local con la remota
git pull origin main         # trae los cambios hechos en GitHub (fast-forward)
```

Para probar el `pull` se creó el archivo `docs/api.md` directamente en GitHub, simulando el aporte de otro integrante del equipo.

## 5. Flujo con ramas

```bash
git checkout -b feature/database-migracion-rol-slug
git add database/migrations/001-agregar-rol-slug-evento.sql
git commit -m "feat(database): agrega la migracion 001 con rol, estado, slug y tabla evento"
git push -u origin feature/database-migracion-rol-slug
git checkout main
git merge --no-ff feature/database-migracion-rol-slug -m "merge: integra la migracion 001 a main"
git push origin main
git tag -a v0.1.0 -m "Sprint 0: repositorio, estructura y esquema de base de datos"
git push origin v0.1.0
```

## 6. Buenas prácticas aplicadas

- Commits pequeños y temáticos con mensajes en formato [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/).
- Una rama por funcionalidad (`feature/<modulo>-<descripcion>`) y fusión con `--no-ff` para conservar la trazabilidad.
- `.gitignore` que excluye `node_modules/`, reportes de pruebas y el archivo `.env`: las credenciales no se suben nunca.
- Repositorio privado, con acceso por invitación.
- Etiquetas de versión al cierre de cada sprint (`v0.1.0`).
- `git pull` antes de empezar a trabajar y documentación actualizada en el mismo commit que el código.

## Historial resultante

```text
*   8688728 (HEAD -> main, tag: v0.1.0, origin/main) merge: integra la migracion 001 a main
|\
| * 5c70dd8 feat(database): agrega la migracion 001 con rol, estado, slug y tabla evento
|/
* da434cb docs: agrega la plantilla de documentacion de la API desde GitHub
* a540bcd chore(database): elimina un archivo de practica ajeno al proyecto
* ff07d77 feat(database): agrega el esquema qr_empresarial y la estructura de backend y docs
* 6780865 feat(frontend): agrega las 11 pantallas, estilos, scripts y pruebas Playwright
* dc35730 chore: inicializa el repositorio con README, .gitignore y .editorconfig
```
