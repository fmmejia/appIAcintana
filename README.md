# Dashboard de Análisis de Deserción Estudiantil | Atenas Risk

Este proyecto es una aplicación de análisis académico del rendimiento y permanencia estudiantil. Su objetivo es detectar de forma temprana a los estudiantes en riesgo de deserción en una asignatura o carrera, evaluando sus calificaciones de laboratorios y exámenes parciales de forma interactiva.

## Estructura del Proyecto (Multipágina)

La aplicación ha sido dividida en dos páginas web físicas independientes para organizar de forma profesional sus flujos de trabajo:

1.  **`index.html`**: Página de inicio y resumen estadístico. Contiene la zona de carga de reportes académicos, el panel con los 4 indicadores KPI generales, 3 gráficos interactivos (donas de riesgo, barras de alerta por carrera e histograma de notas) y el panel lateral para calibrar los parámetros del motor de evaluación de riesgos.
2.  **`estudiantes.html`**: Página exclusiva para el listado de alumnos. Cuenta con la caja de filtros rediseñada en grid (carrera, materia, docente, riesgo), el buscador por nombre/carnet, la tabla de resultados paginada y el modal de ficha técnica con el diagnóstico e impacto en CUM.
3.  **`app.js`**: Controlador de `index.html` que dibuja los gráficos con Chart.js y gestiona las ponderaciones y el upload.
4.  **`estudiantes.js`**: Controlador de `estudiantes.html` que gestiona las búsquedas, paginación, filtros de docentes y apertura de modales.

## Persistencia de Datos local (`localStorage`)

Para compartir los datos entre `index.html` y `estudiantes.html` de forma local y 100% segura, se utiliza el almacenamiento local del navegador (`localStorage`):
*   Cuando cargas datos demo o importas un reporte en cualquier página, la matriz de estudiantes se guarda bajo la clave `atenas_students` y la configuración bajo la clave `atenas_config`.
*   Al abrir `estudiantes.html` o regresar al Dashboard, el sistema lee la información y renderiza los datos actualizados.

## Características Clave del Motor de Riesgos

*   **Riesgo Alto (Reprobado)**: Promedio final **menor a 6.0**.
*   **Riesgo Medio (Alerta CUM)**: Promedio final **entre 6.0 y 6.99**. El estudiante aprueba la asignatura, pero compromete su graduación al situarse bajo la meta del **CUM de egreso (7.0)**.
*   **Riesgo Bajo (Seguro)**: Promedio final **mayor o igual a 7.0**.

## Estructura de Datos Requerida

El archivo de notas (CSV delimitado por punto y coma `;` o Excel `.xlsx`) debe contener estas columnas exactas:

`Docente;Materia;Grupo;Carnet;Apellidos;Nombres;Código Carrera;Lab #1;Par #1;Lab #2;Par #2;Lab #3;Par #3;Lab #4;Par #4;Prom Lab;Prom Par;Nota Final`

## Cómo Ejecutar Localmente

1.  Asegúrese de que todos los archivos (`index.html`, `estudiantes.html`, `styles.css`, `app.js`, `estudiantes.js`) se encuentren en la misma carpeta.
2.  Abra [index.html](file:///C:/Users/fmmejia/OneDrive%20-%20Universidad%20Francisco%20Gavidia/Escritorio/FABRICIO/AppCintana/index.html) en cualquier navegador moderno.
3.  Utilice el botón **"Cargar Datos Demo"** o arrastre su reporte CSV/Excel para poblar la información.
4.  Use el menú lateral para navegar a **"Estudiantes"** (redirección a `estudiantes.html`) o **"Configuración de Alertas"** (redirección a `index.html#configuracion`).
