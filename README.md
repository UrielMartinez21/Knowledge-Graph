# Knowledge Graph 3D

Grafo de conocimiento interactivo con visualización 3D. Estética de red neuronal oscura/cian inspirada en Terminator Salvation — navega, crea nodos con notas en markdown y organízalos visualmente.

![Python](https://img.shields.io/badge/Python-3.13-blue)
![Django](https://img.shields.io/badge/Django-5.1.7-green)
![Three.js](https://img.shields.io/badge/Three.js-0.170-black)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Características

- **Visualización 3D** con Three.js — nodos con glow cian, anillos hexagonales giratorios y conexiones con pulso de brillo
- **CRUD completo** de nodos, aristas y tags vía API REST
- **Markdown** en el contenido de los nodos (renderizado con marked.js)
- **Tags con color** para categorizar nodos
- **Búsqueda** client-side con animación fly-to al nodo encontrado
- **Filtro por tags** con select en la barra superior
- **Simulación de fuerzas** estilo D3 para posicionamiento automático de nodos
- **Modal de creación rápida** — título y contenido en un solo paso

## Flujo de uso

1. Presiona `N` → se abre un modal pidiendo título y contenido
2. Click "Crear" → el nodo aparece en el grafo 3D
3. Asigna tags y conexiones manualmente desde el panel lateral

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Django 5.1.7, Python 3.13 |
| Base de datos | SQLite |
| Frontend | HTML/CSS/JS vanilla, Three.js 0.170 |
| Renderizado 3D | Three.js (WebGL) |
| Markdown | marked.js 15.0.7 |
| Física | Force-directed layout custom (módulo `physics.js`) |

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
│   └── tests.py                # 25+ tests (modelos + API)
├── templates/graph/
│   └── index.html              # SPA — frontend completo
├── static/graph/
│   ├── css/style.css           # Estilos (estética oscura/cian)
│   └── js/
│       ├── main.js             # Orquestador principal
│       ├── scene.js            # Setup de Three.js
│       ├── visuals.js          # Meshes, materiales, efectos
│       ├── physics.js          # Simulación de fuerzas
│       ├── api.js              # Cliente HTTP (fetch)
│       └── state.js            # Estado global de la app
├── manage.py
└── db.sqlite3
```

## Modelos

```
Tag (name, color)
  └── M2M ──┐
Node (title, content, x, y, z, created_at, tags)
  ├── edges_out ──→ Edge (source → target) ──→ Node
  └── edges_in  ←── Edge
```

- **Node** — Nodo con título, contenido markdown, posición 3D y tags
- **Edge** — Conexión dirigida entre dos nodos (unique constraint, sin self-loops)
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
pip install django

# Aplicar migraciones
python manage.py migrate

# Ejecutar servidor
python manage.py runserver
```

Abrir http://127.0.0.1:8000

### Admin

```bash
python manage.py createsuperuser
```

Acceder en http://127.0.0.1:8000/admin/

## Controles

| Acción | Control |
|--------|---------|
| Crear nodo | Tecla `N` |
| Editar nodo | Doble click en el nodo |
| Mover nodo | Arrastrar |
| Paneo de cámara | Arrastrar fondo |
| Zoom | Scroll |
| Buscar | Tecla `F` o click en buscador |
| Filtrar por tag | Select en barra superior |
| Eliminar nodo | Tecla `Delete` (con nodo seleccionado) |
| Guardar nodo | `Ctrl+S` (con panel abierto) |
| Cancelar / Cerrar | `ESC` |

## Tests

```bash
python manage.py test graph
```

## Licencia

MIT
