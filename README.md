# N.E.X.U.S.
### *Neural Exploration & eXpandable Unified System*

Grafo de conocimiento interactivo con visualización 3D. Estética de red neuronal oscura/cian inspirada en Terminator Salvation — navega, crea nodos con notas en markdown y organízalos visualmente.

![Python](https://img.shields.io/badge/Python-3.13-blue)
![Django](https://img.shields.io/badge/Django-5.1.7-green)
![Three.js](https://img.shields.io/badge/Three.js-0.170-black)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Características

- **Visualización 3D** con Three.js — nodos con glow, simulación de fuerzas y conexiones animadas
- **3 niveles de nodos** — Principal (★ dorado), Secundario (◆ esmeralda) y Normal (blanco)
- **CRUD completo** de nodos, aristas y tags vía API REST
- **CLI integrado** — gestiona el grafo desde cualquier terminal
- **Markdown** en el contenido de los nodos (renderizado con marked.js)
- **Tags con color** para categorizar nodos
- **Responsive** — funciona en desktop y dispositivos móviles (touch)
- **Búsqueda** client-side con animación fly-to al nodo encontrado
- **Filtro por tags** con select en la barra superior
- **Simulación de fuerzas** estilo D3 para posicionamiento automático de nodos
- **Modal de creación rápida** — título, contenido y tipo en un solo paso

## Jerarquía de nodos

| Nivel | Icono | Color | Cantidad | Reglas |
|-------|-------|-------|----------|--------|
| Principal | ★ | Dorado | Solo 1 | Puede conectarse a cualquier nodo |
| Secundario | ◆ | Esmeralda | 1 o más | No puede conectarse con otro secundario |
| Normal | · | Blanco | Ilimitados | Sin restricciones |

## Flujo de uso

1. Presiona `N` (o toca `+` en mobile) → se abre un modal pidiendo título, contenido y tipo
2. Click "Crear" → el nodo aparece en el grafo 3D
3. Asigna tags y conexiones desde el panel lateral
4. Cambia el tipo de nodo desde el selector junto al título

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Django 5.1.7, Python 3.13 |
| Base de datos | SQLite |
| Frontend | HTML/CSS/JS vanilla, Three.js 0.170 |
| Renderizado 3D | Three.js (WebGL) |
| Markdown | marked.js 15.0.7 |
| Física | Force-directed layout custom (módulo `physics.js`) |
| CLI | Click, HTTPX, Rich |

## Estructura del proyecto

```
knowledge graph/
├── core/                       # Configuración Django
│   ├── settings/
│   │   ├── base.py             # Settings comunes
│   │   ├── dev.py              # Desarrollo (DEBUG=True, SQLite)
│   │   └── prod.py             # Producción
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── graph/                      # App principal
│   ├── models.py               # Node, Edge, Tag
│   ├── views.py                # API REST (JSON)
│   ├── urls.py                 # Endpoints
│   ├── admin.py                # Admin con color preview y badges
│   └── tests.py                # 32 tests (modelos + API)
├── cli/                        # CLI client
│   ├── nexus.py                # Comandos (click)
│   ├── api_client.py           # Cliente HTTP (httpx)
│   ├── formatters.py           # Salida con Rich (tablas, paneles)
│   ├── config.py               # Configuración (URL del API)
│   └── requirements.txt        # Dependencias del CLI
├── templates/graph/
│   └── index.html              # SPA — frontend completo
├── static/graph/
│   ├── css/style.css           # Estilos (estética oscura, responsive)
│   ├── favicon.svg             # Ícono del proyecto
│   └── js/
│       ├── main.js             # Orquestador principal
│       ├── scene.js            # Setup de Three.js
│       ├── visuals.js          # Meshes, materiales, efectos
│       ├── physics.js          # Simulación de fuerzas
│       ├── api.js              # Cliente HTTP (fetch)
│       └── state.js            # Estado global de la app
├── run.bat                     # Ejecutar servidor (puerto 9500)
├── nexus.bat                   # Ejecutar CLI desde cualquier terminal
├── manage.py
└── db.sqlite3
```

## Modelos

```
Tag (name, color)
  └── M2M ──┐
Node (title, content, x, y, z, node_type, created_at, tags)
  ├── edges_out ──→ Edge (source → target) ──→ Node
  └── edges_in  ←── Edge
```

- **Node** — Nodo con título, contenido markdown, posición 3D, tipo (main/secondary/normal) y tags
- **Edge** — Conexión dirigida entre dos nodos (unique constraint, sin self-loops, sin secondary↔secondary)
- **Tag** — Etiqueta con nombre y color hexadecimal

## API Endpoints

| Método | URL | Descripción |
|--------|-----|-------------|
| `GET` | `/` | Frontend principal (SPA) |
| `GET` | `/api/graph/` | Grafo completo (nodos + aristas + tags) |
| `POST` | `/api/nodes/` | Crear nodo |
| `PUT` | `/api/nodes/<id>/` | Actualizar nodo |
| `DELETE` | `/api/nodes/<id>/` | Eliminar nodo |
| `POST` | `/api/nodes/<id>/tags/` | Asociar tag a nodo |
| `DELETE` | `/api/nodes/<id>/tags/<tag_id>/` | Desasociar tag de nodo |
| `POST` | `/api/edges/` | Crear arista |
| `DELETE` | `/api/edges/<id>/` | Eliminar arista |
| `GET` | `/api/tags/` | Listar tags |
| `POST` | `/api/tags/` | Crear tag |
| `DELETE` | `/api/tags/<id>/` | Eliminar tag |

## Instalación y ejecución

### Requisitos previos

- Python 3.11+

### Setup

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd "knowledge graph"

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependencias
pip install django click httpx rich

# Aplicar migraciones
python manage.py migrate

# Ejecutar servidor
python manage.py runserver 0.0.0.0:9500
```

Abrir http://127.0.0.1:9500

### Ejecución rápida (Windows)

```bash
# Servidor (dejar abierto):
run.bat

# CLI (desde otra terminal):
nexus status
```

### Acceso desde móvil

Con el servidor corriendo, abre desde tu teléfono (misma red WiFi):

```
http://<IP-de-tu-PC>:9500
```

Para obtener tu IP: `ipconfig` en cmd → busca la IPv4 de tu adaptador WiFi.

### Admin

```bash
python manage.py createsuperuser
```

Acceder en http://127.0.0.1:9500/admin/

## CLI

N.E.X.U.S. incluye un cliente de línea de comandos para gestionar el grafo sin abrir el navegador.

### Configuración

Agrega la carpeta del proyecto a tu PATH de Windows:
1. `Win + R` → `sysdm.cpl` → Advanced → Environment Variables
2. En "User variables", edita `Path` y agrega:
   ```
   C:\Users\uriel\OneDrive\Escritorio\Uriel\Python\knowledge graph
   ```
3. Cierra y reabre la terminal

### Comandos

```bash
# Estado general
nexus status

# Crear nodos
nexus add "Machine Learning" --type secondary -c "Supervised, unsupervised..." -t ai
nexus add "Python" --type main -c "Lenguaje principal"

# Listar y buscar
nexus list
nexus list --type secondary
nexus list --tag ai
nexus search "python"

# Información detallada
nexus info 3

# Editar
nexus edit 3 --title "ML" --type normal

# Conectar / desconectar
nexus connect "Machine Learning" "Python"
nexus disconnect "Machine Learning" "Python"

# Tags
nexus tags
nexus tag-add "backend" --color "#00e88f"
nexus tag-delete "old-tag"

# Exportar
nexus export > backup.json

# Eliminar
nexus delete 14
```

### Requisito

El servidor debe estar corriendo (`run.bat`) para que el CLI funcione — se comunica con N.E.X.U.S. vía HTTP.

## Controles (Frontend)

| Acción | Desktop | Mobile |
|--------|---------|--------|
| Crear nodo | Tecla `N` | Botón `+` (FAB) |
| Editar nodo | Doble click | Tap en el nodo |
| Mover nodo | Arrastrar | Arrastrar |
| Paneo de cámara | Arrastrar fondo | Dos dedos |
| Zoom | Scroll | Pinch |
| Buscar | Tecla `F` o click en buscador | Tap en buscador |
| Filtrar por tag | Select en barra superior | Select en barra superior |
| Eliminar nodo | Tecla `Delete` (con panel abierto) | Botón en panel |
| Guardar nodo | `Ctrl+S` (con panel abierto) | Botón en panel |
| Cancelar / Cerrar | `ESC` | Botón ✕ |

## Tests

```bash
python manage.py test graph
```

## Licencia

MIT
