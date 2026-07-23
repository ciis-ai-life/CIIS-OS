# CIIS OS - Centro de Investigación de Identidad Soberana
**Versión:** 0.1.0 | **Arquitectura:** Vanilla ES6 / Glassmorphism

CIIS OS es el entorno de escritorio web oficial del Centro de Investigación de Identidad Soberana. Diseñado bajo los principios de la Constitución Técnica CIIS-000, opera como una interfaz de usuario aislada, modular y criptográficamente segura.

## Arquitectura
*   **Kernel (`kernel.js`):** Bus de eventos, registro de módulos y control de estado.
*   **WindowManager (`windows.js`):** Motor de ventanas (Z-Index automático, Drag & Drop).
*   **Módulos Aislados:** Cada aplicación es un módulo ES6 independiente.
*   **Zero Dependencies:** Sin frameworks (React, Vue, Angular). Puro HTML/CSS/JS.

## Instalación y Despliegue
CIIS OS está diseñado para funcionar de manera estática (Offline-First).
1. Clonar el repositorio.
2. Abrir `index.html` en cualquier navegador moderno.
3. Para producción: Desplegar directamente en **GitHub Pages**. No requiere servidor Node.js ni PHP para la interfaz gráfica.
