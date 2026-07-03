/* ==========================================================================
   LISTADO DE ESTUDIANTES - LOGICA DE NEGOCIO SEPARADA (estudiantes.js)
   ========================================================================== */

// Configuración Global y Variables de Estado
const state = {
  students: [],          // Almacena la lista de estudiantes procesados
  filteredStudents: [],  // Lista filtrada por la búsqueda y dropdowns
  currentPage: 1,
  pageSize: 10,
  filters: {
    search: "",
    risk: "all",
    carrera: "all",
    materia: "all",
    docente: "all"
  },
  sortColumn: "student",
  sortDirection: "asc",
  config: {
    thresholdFail: 6.0,   // Umbral de reprobación (Riesgo Alto)
    thresholdCum: 7.0,    // Umbral meta CUM de egreso (Riesgo Medio)
    weightLab: 0.4,       // Peso de Laboratorios (40% fijo)
    weightPar: 0.6        // Peso de Parciales (60% fijo)
  }
};

// Columnas Requeridas en el CSV/Excel
const REQUIRED_COLUMNS = [
  "Docente", "Materia", "Grupo", "Carnet", "Apellidos", "Nombres", "Código Carrera",
  "Lab #1", "Par #1", "Lab #2", "Par #2", "Lab #3", "Par #3", "Lab #4", "Par #4",
  "Prom Lab", "Prom Par", "Nota Final"
];

// Nombres de Carreras Mapeadas
const CAREER_NAMES = {
  "010306": "Arquitectura. Presencial.",
  "010315": "Ingeniería en Control Eléctrico. Presencial.",
  "010318": "Ingeniería en Ciencias de la computación. No presencial.",
  "010321": "Ingeniería en Diseños y Desarrollo de Videojuegos. Presencial.",
  "010325": "Ingeniería Industrial. Semipresencial.",
  "010332": "Ingeniería en Sistemas y Ciberseguridad. Semipresencial",
  "010801": "Licenciatura en Diseño de Modas. Presencial.",
  "010803": "Licenciatura en Diseño Gráfico Publicitario. Presencial.",
  "010805": "Licenciatura en Diseño Gráfico Web Multimedia. Presencial.",
  "010807": "Técnico en Decoración. Presencial.",
  "010808": "Técnico en Diseño Gráfico Publicitario. Presencial.",
  "010811": "Licenciatura en Animación Digital y Videojuegos. Presencial.",
  "010812": "Técnico en Animación Digital y Videojuegos. Presencial.",
  "010813": "Licenciatura en Diseño Gráfico Publicitario. No Presencial.",
  "010814": "Licenciatura en Diseño Gráfico Publicitario. Semipresencial."
};

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar Iconos Lucide
  lucide.createIcons();
  
  // Registrar Event Listeners
  setupEventListeners();
  
  // Inicializar control de tema claro/oscuro
  setupThemeToggle();
  
  // Inicializar selector global de periodos
  initGlobalPeriodSelector((newPeriod) => {
    loadPersistedData();
  });

  // Cargar datos persistidos desde localStorage
  loadPersistedData();
});

// Escuchar cambios en localStorage desde otras pestañas/páginas
window.addEventListener("storage", (e) => {
  if (e.key === "atenas_students" || e.key === "atenas_config") {
    loadPersistedData();
  }
  if (e.key === "atenas_theme") {
    const isLight = e.newValue === "light";
    if (isLight) {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
    updateThemeIcon();
  }
});

// Cargar Datos Guardados en LocalStorage
function loadPersistedData() {
  const savedStudents = localStorage.getItem("atenas_students");

  state.config = {
    thresholdFail: SYSTEM_CONFIG.thresholdFail,
    thresholdCum: SYSTEM_CONFIG.thresholdCum,
    weightLab: SYSTEM_CONFIG.weightLab,
    weightPar: SYSTEM_CONFIG.weightPar
  };

  if (savedStudents) {
    const allStudents = JSON.parse(savedStudents);
    const activePeriod = getActivePeriod();
    const periodsConfig = getPeriodsConfig();
    const periodConfig = periodsConfig[activePeriod] || DEFAULT_PERIODS_CONFIG["Ciclo 1 - 2026"];

    // Filtrar por el periodo activo y recalcular métricas correspondientes
    state.students = allStudents.filter(s => s.periodo === activePeriod);
    state.students.forEach(student => {
      calculateStudentMetrics(student, state.config, periodConfig);
    });
  } else {
    state.students = [];
  }

  if (state.students.length > 0) {
    // Resetear estado de filtros y ordenamiento
    state.filters = {
      search: "",
      risk: "all",
      carrera: "all",
      materia: "all",
      docente: "all"
    };
    state.sortColumn = "student";
    state.sortDirection = "asc";
    
    // Restaurar placeholder a estado normal
    const btnCargar = document.getElementById("btn-placeholder-cargar");
    if (btnCargar) btnCargar.style.display = "none";

    const titleEl = document.getElementById("search-placeholder-title");
    if (titleEl) titleEl.textContent = "Usa los filtros para buscar estudiantes";

    const descEl = document.getElementById("search-placeholder-desc");
    if (descEl) descEl.textContent = "Puedes buscar por nombre, carnet, materia o docente";

    const iconEl = document.getElementById("search-placeholder-icon-i");
    if (iconEl) {
      iconEl.setAttribute("data-lucide", "search");
      if (window.lucide) window.lucide.createIcons();
    }

    // Cargar filtros dinámicos
    populateFilterDropdowns();
    
    // Renderizar listado de estudiantes
    filterAndRenderStudents();
  } else {
    // Si no hay datos, mostrar placeholder instructivo y contador en 0
    state.filteredStudents = [];
    
    const countEl = document.getElementById("students-found-count");
    if (countEl) countEl.textContent = "0 estudiantes encontrados";
    
    const placeholderEl = document.getElementById("search-placeholder");
    if (placeholderEl) placeholderEl.style.display = "flex";
    
    const tableCard = document.getElementById("students-table-card");
    if (tableCard) tableCard.style.display = "none";

    // Configurar placeholder para indicar que está vacío
    const btnCargar = document.getElementById("btn-placeholder-cargar");
    if (btnCargar) btnCargar.style.display = "inline-flex";

    const titleEl = document.getElementById("search-placeholder-title");
    const activePeriod = getActivePeriod();
    if (titleEl) titleEl.textContent = `Sin Datos en el ${activePeriod}`;

    const descEl = document.getElementById("search-placeholder-desc");
    if (descEl) descEl.textContent = `No hay registros estudiantiles cargados para el periodo '${activePeriod}' en el sistema local. Dirígete a la sección de carga para importar datos o cargar la simulación.`;

    const iconEl = document.getElementById("search-placeholder-icon-i");
    if (iconEl) {
      iconEl.setAttribute("data-lucide", "database-backup");
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

// Guardar datos en localStorage
function persistData() {
  localStorage.setItem("atenas_config", JSON.stringify(state.config));
  localStorage.setItem("atenas_students", JSON.stringify(state.students));
}

// Registrar los Event Listeners de la Interfaz
function setupEventListeners() {
  // Controles de Filtrado en Listado Estudiantes
  const searchInput = document.getElementById("search-students");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.filters.search = searchInput.value.toLowerCase().trim();
      filterAndRenderStudents();
    });
  }
  
  const filterRisk = document.getElementById("filter-risk");
  if (filterRisk) {
    filterRisk.addEventListener("change", () => {
      state.filters.risk = filterRisk.value;
      filterAndRenderStudents();
    });
  }
  
  const filterCarrera = document.getElementById("filter-carrera");
  if (filterCarrera) {
    filterCarrera.addEventListener("change", () => {
      state.filters.carrera = filterCarrera.value;
      filterAndRenderStudents();
    });
  }
  
  const filterMateria = document.getElementById("filter-materia");
  if (filterMateria) {
    filterMateria.addEventListener("change", () => {
      state.filters.materia = filterMateria.value;
      filterAndRenderStudents();
    });
  }
  
  const filterDocente = document.getElementById("filter-docente");
  if (filterDocente) {
    filterDocente.addEventListener("change", () => {
      state.filters.docente = filterDocente.value;
      filterAndRenderStudents();
    });
  }

  // Botón Limpiar Filtros
  const btnClearFilters = document.getElementById("btn-clear-filters");
  if (btnClearFilters) {
    btnClearFilters.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (filterRisk) filterRisk.value = "all";
      if (filterCarrera) filterCarrera.value = "all";
      if (filterMateria) filterMateria.value = "all";
      if (filterDocente) filterDocente.value = "all";
      
      state.filters = {
        search: "",
        risk: "all",
        carrera: "all",
        materia: "all",
        docente: "all"
      };
      state.sortColumn = "student";
      state.sortDirection = "asc";
      filterAndRenderStudents();
    });
  }

  // Configurar ordenamiento interactivo por cabeceras
  setupHeaderSorting();

  // Botón Cerrar Modal
  const btnCloseModal = document.getElementById("btn-close-modal");
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
  
  const studentModal = document.getElementById("student-modal");
  if (studentModal) {
    studentModal.addEventListener("click", (e) => {
      if (e.target.id === "student-modal") closeModal();
    });
  }

  // Botón Imprimir Ficha
  const btnPrint = document.getElementById("btn-print-profile");
  if (btnPrint) {
    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }

  // Selector de ciclos dentro del modal de estudiante
  const periodSelect = document.getElementById("modal-student-period-select");
  if (periodSelect) {
    periodSelect.addEventListener("change", (e) => {
      const targetPeriod = e.target.value;
      if (state.selectedStudentPeriods) {
        const targetStudent = state.selectedStudentPeriods.find(s => s.periodo === targetPeriod);
        if (targetStudent) {
          const periodsConfig = getPeriodsConfig();
          const periodConfig = periodsConfig[targetPeriod] || DEFAULT_PERIODS_CONFIG["Ciclo 1 - 2026"];
          calculateStudentMetrics(targetStudent, state.config, periodConfig);
          state.selectedStudent = targetStudent;
          fillModalDetails(targetStudent, state.selectedStudentPeriods);
        }
      }
    });
  }
}

// Procesar Selección de Archivos
function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

// Mostrar y Ocultar Spinner de Carga
function showLoader(text) {
  const loaderText = document.getElementById("loader-text");
  const loaderContainer = document.getElementById("loader-container");
  const viewEstudiantes = document.getElementById("view-estudiantes");

  if (loaderText) loaderText.textContent = text;
  if (loaderContainer) loaderContainer.style.display = "flex";
  if (viewEstudiantes) viewEstudiantes.style.display = "none";
}

function hideLoader() {
  const loaderContainer = document.getElementById("loader-container");
  const viewEstudiantes = document.getElementById("view-estudiantes");

  if (loaderContainer) loaderContainer.style.display = "none";
  if (viewEstudiantes) viewEstudiantes.style.display = "block";
}

// PROCESADOR CENTRAL DE ARCHIVOS (CSV/EXCEL)
function processFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  showLoader("Leyendo el archivo '" + file.name + "'...");

  setTimeout(() => {
    if (extension === "csv") {
      parseCSV(file);
    } else if (extension === "xlsx" || extension === "xls") {
      parseExcel(file);
    } else {
      hideLoader();
      alert("Formato de archivo no soportado. Por favor, cargue un archivo .csv, .xlsx o .xls");
    }
  }, 500);
}

// Función auxiliar para determinar si una fila es de cabecera
function isHeaderRow(row) {
  if (!row || !Array.isArray(row)) return false;
  let matchCount = 0;

  row.forEach((cell, colIdx) => {
    if (colIdx === 19) return; // Ignorar columna T (retiró carnet físico) al buscar cabecera
    const val = String(cell || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (val.includes("carnet") || val === "codigo" || val === "id") matchCount++;
    if (val.includes("nombre")) matchCount++;
    if (val.includes("apellido")) matchCount++;
    if (val.includes("materia") || val.includes("asignatura") || val === "curso") matchCount++;
    if (val.includes("docente") || val.includes("profesor")) matchCount++;
    if (val.includes("carrera")) matchCount++;
  });

  return matchCount >= 2;
}

// Función auxiliar para detectar cabeceras y parsear filas de forma flexible
function detectHeadersAndParseRows(raw2DArray) {
  if (!raw2DArray || raw2DArray.length === 0) {
    throw new Error("El archivo no contiene filas o datos legibles.");
  }

  // Buscar la fila de cabecera. Si la fila 6 (índice 5) es válida, la usamos directamente.
  let headerIndex = -1;
  if (raw2DArray.length > 5 && isHeaderRow(raw2DArray[5])) {
    headerIndex = 5;
  } else {
    for (let i = 0; i < raw2DArray.length; i++) {
      if (isHeaderRow(raw2DArray[i])) {
        headerIndex = i;
        break;
      }
    }
  }

  if (headerIndex === -1) {
    throw new Error("No se pudo identificar una fila de cabecera válida en el archivo (se requieren al menos dos columnas clave como Carnet, Nombres o Materia).");
  }

  const headers = raw2DArray[headerIndex];
  const fieldIndices = {};

  // Mapear los índices de columnas basados en coincidencias difusas (Primer pase para campos estructurados)
  headers.forEach((headerVal, colIdx) => {
    if (colIdx === 19) return; // Ignorar columna T (retiró carnet físico) completamente
    const val = String(headerVal || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    if (val.includes("docente") || val.includes("profesor") || val.includes("catedratico") || val.includes("instructor")) {
      fieldIndices["Docente"] = colIdx;
    } else if (val.includes("materia") || val.includes("asignatura") || val.includes("curso")) {
      fieldIndices["Materia"] = colIdx;
    } else if (val.includes("grupo") || val.includes("seccion")) {
      fieldIndices["Grupo"] = colIdx;
    } else if (val.includes("carrera") || val.includes("programa")) {
      fieldIndices["Código Carrera"] = colIdx;
    } else if (val.includes("apellido")) {
      fieldIndices["Apellidos"] = colIdx;
    }
  });

  // Segundo pase para Nombres y Carnet con prioridades para evitar colisiones
  headers.forEach((headerVal, colIdx) => {
    if (colIdx === 19) return; // Ignorar columna T (retiró carnet físico) completamente
    const val = String(headerVal || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    // Nombres
    const isDocente = val.includes("docente") || val.includes("profesor") || val.includes("catedratico") || val.includes("instructor");
    if ((val.includes("nombre") || val === "estudiante" || val === "alumno" || val.includes("completo")) && !isDocente) {
      if (fieldIndices["Nombres"] === undefined || val === "nombres" || val === "nombre") {
        fieldIndices["Nombres"] = colIdx;
      }
    }

    // Carnet
    const isCarrera = val.includes("carrera") || val.includes("programa");
    const isMateria = val.includes("materia") || val.includes("asignatura") || val.includes("curso") || val.includes("clase");
    const isDocenteCol = val.includes("docente") || val.includes("profesor");
    
    if (!isCarrera && !isMateria && !isDocenteCol) {
      if (val.includes("carnet") || val.includes("matricula") || val.includes("estudiante") || val.includes("alumno")) {
        fieldIndices["Carnet"] = colIdx; // Alta prioridad
      } else if (val === "codigo" || val === "cod" || val === "id") {
        if (fieldIndices["Carnet"] === undefined) {
          fieldIndices["Carnet"] = colIdx; // Baja prioridad
        }
      }
    }
  });

  // Tercer pase para las notas
  headers.forEach((headerVal, colIdx) => {
    if (colIdx === 19) return; // Ignorar columna T (retiró carnet físico) completamente
    const val = String(headerVal || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    
    if ((val.includes("lab") && val.includes("1")) || val === "l1") {
      fieldIndices["Lab #1"] = colIdx;
    } else if ((val.includes("par") && val.includes("1")) || val === "p1" || (val.includes("ex") && val.includes("1"))) {
      fieldIndices["Par #1"] = colIdx;
    } else if ((val.includes("lab") && val.includes("2")) || val === "l2") {
      fieldIndices["Lab #2"] = colIdx;
    } else if ((val.includes("par") && val.includes("2")) || val === "p2" || (val.includes("ex") && val.includes("2"))) {
      fieldIndices["Par #2"] = colIdx;
    } else if ((val.includes("lab") && val.includes("3")) || val === "l3") {
      fieldIndices["Lab #3"] = colIdx;
    } else if ((val.includes("par") && val.includes("3")) || val === "p3" || (val.includes("ex") && val.includes("3"))) {
      fieldIndices["Par #3"] = colIdx;
    } else if ((val.includes("lab") && val.includes("4")) || val === "l4") {
      fieldIndices["Lab #4"] = colIdx;
    } else if ((val.includes("par") && val.includes("4")) || val === "p4" || (val.includes("ex") && val.includes("4"))) {
      fieldIndices["Par #4"] = colIdx;
    }
  });

  // Validaciones
  if (fieldIndices["Carnet"] === undefined) {
    throw new Error("No se pudo encontrar la columna del identificador del alumno (Carnet, Código, o Matrícula).");
  }
  if (fieldIndices["Materia"] === undefined) {
    throw new Error("No se pudo encontrar la columna de la Materia o Asignatura.");
  }
  if (fieldIndices["Nombres"] === undefined && fieldIndices["Apellidos"] === undefined) {
    throw new Error("No se pudo encontrar la columna del Nombre del alumno.");
  }

  // Parsear filas
  const parsedRows = [];
  for (let i = headerIndex + 1; i < raw2DArray.length; i++) {
    const row = raw2DArray[i];
    if (!row || row.length === 0) continue;

    const carnetRaw = fieldIndices["Carnet"] !== undefined ? row[fieldIndices["Carnet"]] : "";
    const carnetVal = String(carnetRaw || "").trim();
    
    // Ignorar vacíos y filas repetidas de cabecera
    if (!carnetVal || 
        carnetVal.toLowerCase() === "carnet" || 
        carnetVal.toLowerCase() === "codigo" || 
        carnetVal.toLowerCase() === "id" || 
        carnetVal.toLowerCase() === "matricula") {
      continue;
    }

    const rowObj = {
      "Docente": fieldIndices["Docente"] !== undefined ? String(row[fieldIndices["Docente"]] || "").trim() : "Docente Sin Asignar",
      "Materia": fieldIndices["Materia"] !== undefined ? String(row[fieldIndices["Materia"]] || "").trim() : "Asignatura Común",
      "Grupo": fieldIndices["Grupo"] !== undefined ? String(row[fieldIndices["Grupo"]] || "").trim() : "01",
      "Carnet": carnetVal,
      "Apellidos": fieldIndices["Apellidos"] !== undefined ? String(row[fieldIndices["Apellidos"]] || "").trim() : "",
      "Nombres": fieldIndices["Nombres"] !== undefined ? String(row[fieldIndices["Nombres"]] || "").trim() : "Estudiante",
      "Código Carrera": fieldIndices["Código Carrera"] !== undefined ? String(row[fieldIndices["Código Carrera"]] || "").trim() : "GEN",
      "Lab #1": fieldIndices["Lab #1"] !== undefined ? parseFloat(String(row[fieldIndices["Lab #1"]]).replace(",", ".") || 0) : 0,
      "Par #1": fieldIndices["Par #1"] !== undefined ? parseFloat(String(row[fieldIndices["Par #1"]]).replace(",", ".") || 0) : 0,
      "Lab #2": fieldIndices["Lab #2"] !== undefined ? parseFloat(String(row[fieldIndices["Lab #2"]]).replace(",", ".") || 0) : 0,
      "Par #2": fieldIndices["Par #2"] !== undefined ? parseFloat(String(row[fieldIndices["Par #2"]]).replace(",", ".") || 0) : 0,
      "Lab #3": fieldIndices["Lab #3"] !== undefined ? parseFloat(String(row[fieldIndices["Lab #3"]]).replace(",", ".") || 0) : 0,
      "Par #3": fieldIndices["Par #3"] !== undefined ? parseFloat(String(row[fieldIndices["Par #3"]]).replace(",", ".") || 0) : 0,
      "Lab #4": fieldIndices["Lab #4"] !== undefined ? parseFloat(String(row[fieldIndices["Lab #4"]]).replace(",", ".") || 0) : 0,
      "Par #4": fieldIndices["Par #4"] !== undefined ? parseFloat(String(row[fieldIndices["Par #4"]]).replace(",", ".") || 0) : 0
    };

    for (let key of ["Lab #1", "Par #1", "Lab #2", "Par #2", "Lab #3", "Par #3", "Lab #4", "Par #4"]) {
      if (isNaN(rowObj[key])) {
        rowObj[key] = 0;
      }
    }

    parsedRows.push(rowObj);
  }

  return parsedRows;
}

// Analizar archivo CSV usando PapaParse
function parseCSV(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    let text;
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      text = utf8Decoder.decode(arrayBuffer);
    } catch (err) {
      const winDecoder = new TextDecoder('windows-1252');
      text = winDecoder.decode(arrayBuffer);
    }
    
    Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      complete: function(results) {
        try {
          const rows = detectHeadersAndParseRows(results.data);
          handleParsedRows(rows);
        } catch (err) {
          hideLoader();
          alert("Error al procesar el archivo CSV: " + err.message);
        }
      },
      error: function(err) {
        hideLoader();
        alert("Error al parsear el archivo CSV: " + err.message);
      }
    });
  };
  reader.onerror = function() {
    hideLoader();
    alert("Error al leer el archivo CSV.");
  };
  reader.readAsArrayBuffer(file);
}

// Analizar Excel usando SheetJS
function parseExcel(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const raw2DArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      
      const rows = detectHeadersAndParseRows(raw2DArray);
      handleParsedRows(rows);
    } catch (err) {
      hideLoader();
      alert("Error al procesar el archivo Excel: " + err.message);
    }
  };
  reader.onerror = function() {
    hideLoader();
    alert("Error al leer el archivo del dispositivo.");
  };
  reader.readAsArrayBuffer(file);
}

// Manejar los datos crudos extraídos del archivo
function handleParsedRows(rawRows) {
  if (!rawRows || rawRows.length === 0) {
    hideLoader();
    alert("El archivo está vacío o no se pudo extraer ninguna fila de datos válida.");
    return;
  }

  // Agrupar filas duplicadas por estudiante (Carnet) e inyectar su historial
  state.students = groupAndCalculateStudents(rawRows, state.config);
  
  // Persistir nuevos datos
  persistData();

  // Resetear filtros en memoria
  state.filters = {
    search: "",
    risk: "all",
    carrera: "all",
    materia: "all",
    docente: "all"
  };
  state.sortColumn = "student";
  state.sortDirection = "asc";

  // Configurar filtros dinámicos
  populateFilterDropdowns();

  // Resetear filtros del DOM
  document.getElementById("search-students").value = "";
  document.getElementById("filter-risk").value = "all";
  document.getElementById("filter-carrera").value = "all";
  document.getElementById("filter-materia").value = "all";
  document.getElementById("filter-docente").value = "all";

  hideLoader();
  filterAndRenderStudents();
  
  alert("Archivo cargado exitosamente. Se importaron los registros de " + state.students.length + " estudiantes únicos.");
}

// Agrupar filas duplicadas por estudiante (Carnet) e inyectar su historial
function groupAndCalculateStudents(rawRows, config) {
  const studentMap = new Map();
  
  rawRows.forEach((row) => {
    // Sanitizar claves
    const cleanRow = {};
    for (let key in row) {
      cleanRow[key.trim()] = row[key];
    }
    
    const carnetVal = String(cleanRow["Carnet"] || "").trim();
    if (!carnetVal) return;
    
    if (!studentMap.has(carnetVal)) {
      studentMap.set(carnetVal, {
        carnet: carnetVal,
        nombres: cleanRow["Nombres"] || "Estudiante",
        apellidos: cleanRow["Apellidos"] || "",
        carrera: String(cleanRow["Código Carrera"] || "GEN").trim().toUpperCase(),
        subjects: []
      });
    }
    
    const studentObj = studentMap.get(carnetVal);
    
    studentObj.subjects.push({
      docente: cleanRow["Docente"] || "Docente Sin Asignar",
      materia: cleanRow["Materia"] || "Asignatura Común",
      grupo: cleanRow["Grupo"] || "01",
      lab1: parseFloat(cleanRow["Lab #1"] || 0),
      par1: parseFloat(cleanRow["Par #1"] || 0),
      lab2: parseFloat(cleanRow["Lab #2"] || 0),
      par2: parseFloat(cleanRow["Par #2"] || 0),
      lab3: parseFloat(cleanRow["Lab #3"] || 0),
      par3: parseFloat(cleanRow["Par #3"] || 0),
      lab4: parseFloat(cleanRow["Lab #4"] || 0),
      par4: parseFloat(cleanRow["Par #4"] || 0)
    });
  });
  
  const studentsArray = Array.from(studentMap.values());
  
  studentsArray.forEach((student, idx) => {
    student.id = idx + 1;
    calculateStudentGroupMetrics(student, config);
  });
  
  return studentsArray;
}

// Calcular notas finales y estado de riesgo general para un estudiante agrupado
function calculateStudentGroupMetrics(student, config) {
  let sumFinalGrades = 0;
  let failingCount = 0;
  
  student.subjects.forEach(subj => {
    // Promedio de laboratorios
    const sumLabs = subj.lab1 + subj.lab2 + subj.lab3 + subj.lab4;
    subj.calculatedPromLab = sumLabs / 4;
    
    // Promedio de parciales
    const sumPars = subj.par1 + subj.par2 + subj.par3 + subj.par4;
    subj.calculatedPromPar = sumPars / 4;
    
    // Nota final de la asignatura
    subj.calculatedFinal = (subj.calculatedPromLab * config.weightLab) + (subj.calculatedPromPar * config.weightPar);
    
    // Riesgo por materia
    if (subj.calculatedFinal < config.thresholdFail) {
      subj.riskLevel = "high";
      failingCount++;
    } else if (subj.calculatedFinal < config.thresholdCum) {
      subj.riskLevel = "medium";
    } else {
      subj.riskLevel = "low";
    }
    
    sumFinalGrades += subj.calculatedFinal;
  });
  
  const totalSubjects = student.subjects.length;
  student.calculatedFinal = totalSubjects > 0 ? (sumFinalGrades / totalSubjects) : 0;
  student.failingCount = failingCount;
  
  // Regla general de riesgo:
  // - Riesgo Alto: Si reprueba >= 1 materia o CUM < 6.0
  // - Riesgo Medio: Si aprueba todas pero CUM < 7.0
  // - Riesgo Bajo: Si aprueba todas y CUM >= 7.0
  if (failingCount > 0 || student.calculatedFinal < config.thresholdFail) {
    student.riskLevel = "high";
  } else if (student.calculatedFinal < config.thresholdCum) {
    student.riskLevel = "medium";
  } else {
    student.riskLevel = "low";
  }
  
  // Calcular puntaje de riesgo para ordenamiento prioritario (0-100)
  let score = 0;
  const final = student.calculatedFinal;
  if (student.riskLevel === "high") {
    const failRatio = totalSubjects > 0 ? (failingCount / totalSubjects) : 0;
    const cumPenalty = Math.max(0, (config.thresholdFail - final) / config.thresholdFail) * 20;
    score = 60 + (failRatio * 20) + cumPenalty;
  } else if (student.riskLevel === "medium") {
    score = 20 + ((config.thresholdCum - final) / (config.thresholdCum - config.thresholdFail)) * 40;
  } else {
    score = Math.max(0, 20 - ((final - config.thresholdCum) / (10.0 - config.thresholdCum)) * 20);
  }
  
  student.riskScore = Math.min(100, Math.max(0, score));
}

// Rellenar dropdowns de filtros dinámicamente (Excel-like dependent dropdowns)
function populateFilterDropdowns() {
  const carreraSelect = document.getElementById("filter-carrera");
  const materiaSelect = document.getElementById("filter-materia");
  const docenteSelect = document.getElementById("filter-docente");

  if (!carreraSelect || !materiaSelect || !docenteSelect) return;

  const searchQuery = state.filters.search;
  const riskFilter = state.filters.risk;
  const carreraFilter = state.filters.carrera;
  const materiaFilter = state.filters.materia;
  const docenteFilter = state.filters.docente;

  // 1. Filtrar para Carreras (ignora carreraFilter)
  const studentsForCarrera = state.students.filter(student => {
    const matchesSearch = searchQuery === "" || 
      student.nombres.toLowerCase().includes(searchQuery) ||
      student.apellidos.toLowerCase().includes(searchQuery) ||
      student.carnet.toLowerCase().includes(searchQuery);
    const matchesRisk = riskFilter === "all" || student.riskLevel === riskFilter;
    
    // El estudiante debe cursar al menos una materia que coincida con la materia y docente seleccionados
    const matchesSubject = student.subjects.some(subj => {
      const mMat = materiaFilter === "all" || normalizeStr(subj.materia) === normalizeStr(materiaFilter);
      const mDoc = docenteFilter === "all" || normalizeStr(subj.docente) === normalizeStr(docenteFilter);
      return mMat && mDoc;
    });
    
    return matchesSearch && matchesRisk && matchesSubject;
  });
  const availableCarreras = [...new Set(studentsForCarrera.map(s => s.carrera))].sort();

  // 2. Filtrar para Materias (ignora materiaFilter)
  const studentsForMateria = state.students.filter(student => {
    const matchesSearch = searchQuery === "" || 
      student.nombres.toLowerCase().includes(searchQuery) ||
      student.apellidos.toLowerCase().includes(searchQuery) ||
      student.carnet.toLowerCase().includes(searchQuery);
    const matchesRisk = riskFilter === "all" || student.riskLevel === riskFilter;
    const matchesCarrera = carreraFilter === "all" || student.carrera === carreraFilter;
    
    const matchesSubject = student.subjects.some(subj => docenteFilter === "all" || normalizeStr(subj.docente) === normalizeStr(docenteFilter));
    
    return matchesSearch && matchesRisk && matchesCarrera && matchesSubject;
  });
  const allMaterias = [];
  studentsForMateria.forEach(s => {
    s.subjects.forEach(subj => {
      if (docenteFilter === "all" || normalizeStr(subj.docente) === normalizeStr(docenteFilter)) {
        allMaterias.push(subj.materia);
      }
    });
  });
  const availableMaterias = [...new Set(allMaterias)].sort((a, b) => a.localeCompare(b));

  // 3. Filtrar para Docentes (ignora docenteFilter)
  const studentsForDocente = state.students.filter(student => {
    const matchesSearch = searchQuery === "" || 
      student.nombres.toLowerCase().includes(searchQuery) ||
      student.apellidos.toLowerCase().includes(searchQuery) ||
      student.carnet.toLowerCase().includes(searchQuery);
    const matchesRisk = riskFilter === "all" || student.riskLevel === riskFilter;
    const matchesCarrera = carreraFilter === "all" || student.carrera === carreraFilter;
    
    const matchesSubject = student.subjects.some(subj => materiaFilter === "all" || normalizeStr(subj.materia) === normalizeStr(materiaFilter));
    
    return matchesSearch && matchesRisk && matchesCarrera && matchesSubject;
  });
  const allDocentes = [];
  studentsForDocente.forEach(s => {
    s.subjects.forEach(subj => {
      if (materiaFilter === "all" || normalizeStr(subj.materia) === normalizeStr(materiaFilter)) {
        allDocentes.push(subj.docente);
      }
    });
  });
  const availableDocentes = [...new Set(allDocentes)].sort((a, b) => a.localeCompare(b));

  // 4. Actualizar Carrera Dropdown
  const prevCarrera = carreraFilter;
  carreraSelect.innerHTML = '<option value="all">Todas las carreras</option>';
  availableCarreras.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = CAREER_NAMES[c] || c;
    carreraSelect.appendChild(opt);
  });
  if (prevCarrera === "all" || availableCarreras.includes(prevCarrera)) {
    carreraSelect.value = prevCarrera;
  } else {
    carreraSelect.value = "all";
    state.filters.carrera = "all";
  }

  // 5. Actualizar Materia Dropdown
  const prevMateria = materiaFilter;
  materiaSelect.innerHTML = '<option value="all">Todas las materias</option>';
  availableMaterias.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    materiaSelect.appendChild(opt);
  });
  if (prevMateria === "all" || availableMaterias.includes(prevMateria)) {
    materiaSelect.value = prevMateria;
  } else {
    materiaSelect.value = "all";
    state.filters.materia = "all";
  }

  // 6. Actualizar Docente Dropdown
  const prevDocente = docenteFilter;
  docenteSelect.innerHTML = '<option value="all">Todos los docentes</option>';
  availableDocentes.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    docenteSelect.appendChild(opt);
  });
  if (prevDocente === "all" || availableDocentes.includes(prevDocente)) {
    docenteSelect.value = prevDocente;
  } else {
    docenteSelect.value = "all";
    state.filters.docente = "all";
  }
}

// FILTRADO Y RENDERIZADO DE LA TABLA GENERAL DE ESTUDIANTES
function filterAndRenderStudents() {
  // 1. Rellenar dropdowns con opciones dependientes
  populateFilterDropdowns();

  const searchQuery = state.filters.search;
  const riskFilter = state.filters.risk;
  const carreraFilter = state.filters.carrera;
  const materiaFilter = state.filters.materia;
  const docenteFilter = state.filters.docente;

  // Filtrar
  state.filteredStudents = state.students.filter(student => {
    const matchesSearch = searchQuery === "" || 
      student.nombres.toLowerCase().includes(searchQuery) ||
      student.apellidos.toLowerCase().includes(searchQuery) ||
      student.carnet.toLowerCase().includes(searchQuery);

    const matchesRisk = riskFilter === "all" || student.riskLevel === riskFilter;
    const matchesCarrera = carreraFilter === "all" || student.carrera === carreraFilter;
    
    // Se filtra por la combinación exacta del par Materia-Docente en la misma fila del alumno
    const matchesSubject = student.subjects.some(subj => {
      const mMat = materiaFilter === "all" || normalizeStr(subj.materia) === normalizeStr(materiaFilter);
      const mDoc = docenteFilter === "all" || normalizeStr(subj.docente) === normalizeStr(docenteFilter);
      return mMat && mDoc;
    });

    return matchesSearch && matchesRisk && matchesCarrera && matchesSubject;
  });

  // Ordenar la lista filtrada
  sortFilteredStudents();

  // Lógica de visualización: Ocultar tabla y mostrar placeholder si no hay filtros activos
  const isFilterActive = searchQuery !== "" || riskFilter !== "all" || carreraFilter !== "all" || materiaFilter !== "all" || docenteFilter !== "all";
  
  const tableCard = document.getElementById("students-table-card");
  const placeholderCard = document.getElementById("search-placeholder");
  const labelEl = document.getElementById("students-found-count");

  if (isFilterActive) {
    if (tableCard) tableCard.style.display = "block";
    if (placeholderCard) placeholderCard.style.display = "none";
  } else {
    if (tableCard) tableCard.style.display = "none";
    if (placeholderCard) placeholderCard.style.display = "flex";
  }

  // Mostrar u ocultar botón de limpiar filtros
  const btnClearFilters = document.getElementById("btn-clear-filters");
  if (btnClearFilters) {
    btnClearFilters.style.display = isFilterActive ? "flex" : "none";
  }

  // Actualizar contador
  const countToShow = isFilterActive ? state.filteredStudents.length : state.students.length;
  if (labelEl) {
    if (countToShow === 1) {
      labelEl.textContent = "1 estudiante encontrado";
    } else {
      labelEl.textContent = `${countToShow} estudiantes encontrados`;
    }
  }

  // Reiniciar a primera página al filtrar
  state.currentPage = 1;
  renderStudentsTable();

  // Renderizar badges de filtros activos
  renderActiveFiltersBadges();
}

// Renderizar badges de filtros activos
function renderActiveFiltersBadges() {
  const container = document.getElementById("active-filters-container");
  if (!container) return;

  container.innerHTML = "";
  
  const searchQuery = state.filters.search;
  const riskFilter = state.filters.risk;
  const carreraFilter = state.filters.carrera;
  const materiaFilter = state.filters.materia;
  const docenteFilter = state.filters.docente;

  const riskSelect = document.getElementById("filter-risk");
  const carreraSelect = document.getElementById("filter-carrera");
  const searchInput = document.getElementById("search-students");
  const materiaSelect = document.getElementById("filter-materia");
  const docenteSelect = document.getElementById("filter-docente");

  const activeFilters = [];

  if (searchQuery !== "") {
    activeFilters.push({
      label: `Búsqueda: "${searchQuery}"`,
      clear: () => {
        state.filters.search = "";
        if (searchInput) searchInput.value = "";
      }
    });
  }

  if (riskFilter !== "all" && riskSelect) {
    const option = riskSelect.querySelector(`option[value="${riskFilter}"]`);
    const text = option ? option.text : riskFilter;
    activeFilters.push({
      label: `Riesgo: ${text}`,
      clear: () => {
        state.filters.risk = "all";
        riskSelect.value = "all";
      }
    });
  }

  if (carreraFilter !== "all" && carreraSelect) {
    const option = carreraSelect.querySelector(`option[value="${carreraFilter}"]`);
    const text = option ? option.text : (CAREER_NAMES[carreraFilter] || carreraFilter);
    activeFilters.push({
      label: `Carrera: ${text}`,
      clear: () => {
        state.filters.carrera = "all";
        carreraSelect.value = "all";
      }
    });
  }

  if (materiaFilter !== "all") {
    activeFilters.push({
      label: `Materia: ${materiaFilter}`,
      clear: () => {
        state.filters.materia = "all";
        if (materiaSelect) materiaSelect.value = "all";
      }
    });
  }

  if (docenteFilter !== "all") {
    activeFilters.push({
      label: `Docente: ${docenteFilter}`,
      clear: () => {
        state.filters.docente = "all";
        if (docenteSelect) docenteSelect.value = "all";
      }
    });
  }

  if (activeFilters.length === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";

  activeFilters.forEach(filter => {
    const badge = document.createElement("span");
    badge.className = "active-filter-badge-item";
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(21, 101, 192, 0.1);
      border: 1px solid rgba(21, 101, 192, 0.25);
      color: var(--text-main);
      border-radius: 16px;
      font-size: 0.78rem;
      font-weight: 500;
      transition: var(--transition-smooth);
    `;

    badge.addEventListener("mouseenter", () => {
      badge.style.background = "rgba(21, 101, 192, 0.2)";
      badge.style.borderColor = "var(--color-primary)";
    });
    badge.addEventListener("mouseleave", () => {
      badge.style.background = "rgba(21, 101, 192, 0.1)";
      badge.style.borderColor = "rgba(21, 101, 192, 0.25)";
    });

    const textSpan = document.createElement("span");
    textSpan.textContent = filter.label;
    badge.appendChild(textSpan);

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0 2px;
      font-weight: bold;
      transition: var(--transition-smooth);
    `;
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.color = "var(--color-risk-high)";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.color = "var(--text-muted)";
    });
    closeBtn.addEventListener("click", () => {
      filter.clear();
      filterAndRenderStudents();
    });

    badge.appendChild(closeBtn);
    container.appendChild(badge);
  });
}

// Renderizar tabla con paginación
function renderStudentsTable() {
  const tbody = document.getElementById("students-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const totalFiltered = state.filteredStudents.length;

  if (totalFiltered === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);"><i data-lucide="info" style="vertical-align: middle; margin-right: 8px;"></i> ${t("msg_no_students_found")}</td></tr>`;
    document.getElementById("pagination-text").textContent = t("records_showing", { start: 0, end: 0, total: 0 });
    document.getElementById("pagination-btns").innerHTML = "";
    lucide.createIcons();
    return;
  }

  const startIdx = (state.currentPage - 1) * state.pageSize;
  const endIdx = Math.min(startIdx + state.pageSize, totalFiltered);
  const paginatedStudents = state.filteredStudents.slice(startIdx, endIdx);

  paginatedStudents.forEach(student => {
    const tr = document.createElement("tr");

    let badgeClass = "badge-risk-low";
    let badgeLabel = t("badge_risk_low");
    if (student.riskLevel === "high") {
      badgeClass = "badge-risk-high";
      badgeLabel = t("badge_risk_high");
    } else if (student.riskLevel === "medium") {
      badgeClass = "badge-risk-medium";
      badgeLabel = t("badge_risk_medium");
    }

    tr.innerHTML = `
      <td>
        <div class="td-student-info">
          <span class="student-name">${student.apellidos}, ${student.nombres}</span>
          <span class="student-carnet">${student.carnet}</span>
        </div>
      </td>
      <td>
        <span style="font-weight: 500; font-size: 0.82rem; line-height: 1.25;">
          ${CAREER_NAMES[student.carrera] || student.carrera}
        </span>
      </td>
      <td style="text-align: center; font-weight: 600;">${student.subjects.length}</td>
      <td style="text-align: center; font-family: monospace; font-weight: 700;">${student.calculatedFinal.toFixed(2)}</td>
      <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
      <td style="text-align: center;">
        <button class="btn-action-view" onclick="openStudentModal('${student.id}')">
          <i data-lucide="user-cog"></i> Ficha
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("pagination-text").textContent = t("records_showing", { start: startIdx + 1, end: endIdx, total: totalFiltered });
  renderPaginationButtons(totalFiltered);
  lucide.createIcons();
}

// Generar botones de páginas
function renderPaginationButtons(totalFiltered) {
  const container = document.getElementById("pagination-btns");
  if (!container) return;
  container.innerHTML = "";

  const totalPages = Math.ceil(totalFiltered / state.pageSize);
  if (totalPages <= 1) return;

  const btnPrev = document.createElement("button");
  btnPrev.className = "btn-page";
  btnPrev.innerHTML = '<i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i>';
  btnPrev.disabled = state.currentPage === 1;
  btnPrev.onclick = () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderStudentsTable();
    }
  };
  container.appendChild(btnPrev);

  const maxButtons = 5;
  let startPage = Math.max(1, state.currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    const btn = document.createElement("button");
    btn.className = `btn-page ${p === state.currentPage ? 'active' : ''}`;
    btn.textContent = p;
    btn.onclick = () => {
      state.currentPage = p;
      renderStudentsTable();
    };
    container.appendChild(btn);
  }

  const btnNext = document.createElement("button");
  btnNext.className = "btn-page";
  btnNext.innerHTML = '<i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>';
  btnNext.disabled = state.currentPage === totalPages;
  btnNext.onclick = () => {
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderStudentsTable();
    }
  };
  container.appendChild(btnNext);
}

// ABRIR Y LLENAR EL MODAL DETALLADO DE ESTUDIANTE (AGRUPADO)
function openStudentModal(id) {
  const student = state.students.find(s => s.id === id);
  if (!student) return;

  state.selectedStudent = student;

  const savedStudents = localStorage.getItem("atenas_students");
  const allStudents = savedStudents ? JSON.parse(savedStudents) : [];
  const studentPeriods = allStudents.filter(s => s.carnet === student.carnet);
  state.selectedStudentPeriods = studentPeriods;

  fillModalDetails(student, studentPeriods);
}

function fillModalDetails(student, studentPeriods) {
  // Abreviar iniciales para avatar
  const iniciales = (student.nombres[0] || "") + (student.apellidos[0] || "");
  document.getElementById("modal-avatar").textContent = iniciales.toUpperCase();

  // Llenar datos de texto
  document.getElementById("modal-student-name").textContent = `${student.apellidos}, ${student.nombres}`;
  document.getElementById("modal-student-carnet").textContent = student.carnet;
  document.getElementById("modal-student-carrera").textContent = CAREER_NAMES[student.carrera] || student.carrera;
  document.getElementById("modal-student-registros-count").textContent = `${student.subjects.length} asignatura(s)`;

  // Notas consolidadas del Estudiante
  document.getElementById("modal-cum-value").textContent = student.calculatedFinal.toFixed(2);
  document.getElementById("modal-subjects-count").textContent = student.subjects.length;
  document.getElementById("modal-reprobando-count").textContent = student.failingCount;

  // Barra de Progreso del CUM (escala 0-10)
  const cumProgress = document.getElementById("modal-cum-progress");
  if (cumProgress) {
    const percentage = Math.min(100, Math.max(0, student.calculatedFinal * 10));
    cumProgress.style.width = percentage + "%";
    
    // Cambiar color de la barra según nivel de riesgo general
    if (student.riskLevel === "high") {
      cumProgress.style.backgroundColor = "var(--color-risk-high)";
    } else if (student.riskLevel === "medium") {
      cumProgress.style.backgroundColor = "var(--color-risk-medium)";
    } else {
      cumProgress.style.backgroundColor = "var(--color-risk-low)";
    }
  }

  // Poblar selector de periodos del estudiante en el modal
  const periodSelect = document.getElementById("modal-student-period-select");
  if (periodSelect) {
    periodSelect.innerHTML = "";
    studentPeriods.sort((a,b) => a.periodo.localeCompare(b.periodo)).forEach(sp => {
      const opt = document.createElement("option");
      opt.value = sp.periodo;
      opt.textContent = sp.periodo;
      if (sp.periodo === student.periodo) {
        opt.selected = true;
      }
      periodSelect.appendChild(opt);
    });
    periodSelect.value = student.periodo;
  }

  // Leyenda de unidad de corte activa
  const legendEl = document.getElementById("modal-student-unit-legend");
  if (legendEl) {
    const periodsConfig = getPeriodsConfig();
    const periodConfig = periodsConfig[student.periodo];
    if (periodConfig) {
      const unit = getAnalysisUnit(periodConfig);
      legendEl.textContent = `(Corte: Unidad ${unit})`;
    } else {
      legendEl.textContent = "";
    }
  }

  // Inyectar el Historial de Notas (Tabla de Asignaturas)
  const tableBody = document.getElementById("modal-subjects-table-body");
  tableBody.innerHTML = "";

  student.subjects.forEach((subj, idx) => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    if (idx === 0) {
      tr.classList.add("selected-subject-row");
    }
    
    let badgeClass = "badge-risk-low";
    let badgeLabel = t("status_passed");
    if (subj.calculatedFinal < state.config.thresholdFail) {
      badgeClass = "badge-risk-high";
      badgeLabel = t("status_failed");
    } else if (subj.calculatedFinal < state.config.thresholdCum) {
      badgeClass = "badge-risk-medium";
      badgeLabel = t("status_passed");
    }

    tr.innerHTML = `
      <td style="font-weight: 500;">${subj.materia}</td>
      <td style="text-align: center; font-family: monospace; font-weight: 600;">${subj.calculatedFinal.toFixed(2)}/10</td>
      <td style="text-align: center; color: var(--text-muted); display: none;">${student.periodo}</td>
      <td style="text-align: center;"><span class="badge ${badgeClass}">${badgeLabel}</span></td>
    `;

    tr.addEventListener("click", () => {
      const rows = tableBody.querySelectorAll("tr");
      rows.forEach(r => r.classList.remove("selected-subject-row"));
      tr.classList.add("selected-subject-row");
      populateSubjectDetails(subj);
    });

    tableBody.appendChild(tr);
  });

  // Cargar detalles de la primera asignatura por defecto
  if (student.subjects.length > 0) {
    populateSubjectDetails(student.subjects[0]);
  } else {
    clearSubjectDetails();
  }

  // Generar Alertas Académicas del Estudiante
  const alertsList = document.getElementById("modal-alerts-list");
  alertsList.innerHTML = "";
  
  student.subjects.forEach(subj => {
    if (subj.calculatedFinal < state.config.thresholdFail) {
      const alertDiv = document.createElement("div");
      alertDiv.className = "alert-item-student fail";
      alertDiv.innerHTML = `<i data-lucide="alert-triangle" class="text-risk-high"></i> <span>${t("alert_failing_subject", { materia: subj.materia, nota: subj.calculatedFinal.toFixed(2) })}</span>`;
      alertsList.appendChild(alertDiv);
    } else if (subj.calculatedFinal < state.config.thresholdCum) {
      const alertDiv = document.createElement("div");
      alertDiv.className = "alert-item-student warn";
      alertDiv.innerHTML = `<i data-lucide="alert-circle" class="text-risk-medium"></i> <span>${t("alert_low_performance", { materia: subj.materia, nota: subj.calculatedFinal.toFixed(2) })}</span>`;
      alertsList.appendChild(alertDiv);
    }
  });

  let hasDecliningTrend = false;
  student.subjects.forEach(subj => {
    if ((subj.par3 < subj.par1 && subj.par3 < 6.0 && subj.par3 > 0) || (subj.par4 < subj.par2 && subj.par4 < 6.0 && subj.par4 > 0)) {
      hasDecliningTrend = true;
    }
  });
  if (hasDecliningTrend) {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert-item-student info";
    alertDiv.innerHTML = `<i data-lucide="trending-down" class="text-info"></i> <span>${t("alert_descending_trend")}</span>`;
    alertsList.appendChild(alertDiv);
  }

  if (student.riskLevel === "high") {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert-item-student fail";
    alertDiv.innerHTML = `<i data-lucide="alert-triangle" class="text-risk-high"></i> <span>${t("alert_general_risk_high", { nota: student.calculatedFinal.toFixed(2) })}</span>`;
    alertsList.appendChild(alertDiv);
  } else if (student.riskLevel === "medium") {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert-item-student warn";
    alertDiv.innerHTML = `<i data-lucide="alert-circle" class="text-risk-medium"></i> <span>${t("alert_general_risk_medium", { nota: student.calculatedFinal.toFixed(2) })}</span>`;
    alertsList.appendChild(alertDiv);
  } else {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert-item-student safe";
    alertDiv.innerHTML = `<i data-lucide="check-circle" class="text-risk-low"></i> <span>${t("alert_general_risk_low", { nota: student.calculatedFinal.toFixed(2) })}</span>`;
    alertsList.appendChild(alertDiv);
  }

  // Pintar carta de diagnóstico general
  const diagCard = document.getElementById("modal-diagnostic-card");
  const diagIcon = document.getElementById("modal-diagnostic-icon");
  const diagTitle = document.getElementById("modal-diagnostic-title");
  const diagDesc = document.getElementById("modal-diagnostic-desc");

  let diagClass = "risk-low";
  let titleText = "";
  let descText = "";

  if (student.riskLevel === "high") {
    diagClass = "risk-high";
    titleText = t("diag_high_title");
    descText = t("diag_high_desc", { count: student.failingCount, nota: student.calculatedFinal.toFixed(2), threshold: state.config.thresholdFail.toFixed(1) });
  } else if (student.riskLevel === "medium") {
    diagClass = "risk-medium";
    titleText = t("diag_medium_title");
    descText = t("diag_medium_desc", { nota: student.calculatedFinal.toFixed(2), threshold: state.config.thresholdCum.toFixed(1) });
  } else {
    diagClass = "risk-low";
    titleText = t("diag_low_title");
    descText = t("diag_low_desc", { nota: student.calculatedFinal.toFixed(2) });
  }

  if (diagCard) {
    diagCard.className = `alert-indicator-card ${diagClass}`;
  }
  if (diagTitle) diagTitle.textContent = titleText;
  if (diagDesc) diagDesc.textContent = descText;

  if (diagIcon) {
    diagIcon.setAttribute("data-lucide", student.riskLevel === "high" ? "alert-triangle" : (student.riskLevel === "medium" ? "alert-circle" : "check-circle"));
  }

  // Generar recomendaciones del Plan de Acompañamiento
  const recContainer = document.getElementById("modal-recommendations-container");
  if (recContainer) {
    recContainer.innerHTML = "";
    
    // Recomendaciones específicas por materias reprobadas
    student.subjects.forEach(subj => {
      if (subj.calculatedFinal < state.config.thresholdFail) {
        const item = document.createElement("div");
        item.className = "rec-item";
        item.innerHTML = `
          <i data-lucide="help-circle"></i>
          <p>
            ${t("rec_subject_fail", { materia: subj.materia, docente: subj.docente })}
          </p>
        `;
        recContainer.appendChild(item);
      }
    });

    // Recomendación general por promedio general bajo
    if (student.riskLevel === "high") {
      const item = document.createElement("div");
      item.className = "rec-item";
      item.innerHTML = `
        <i data-lucide="check-square"></i>
        <p>
          ${t("rec_general_high")}
        </p>
      `;
      recContainer.appendChild(item);
    } else if (student.riskLevel === "medium") {
      const item = document.createElement("div");
      item.className = "rec-item";
      item.innerHTML = `
        <i data-lucide="award"></i>
        <p>
          ${t("rec_general_medium")}
        </p>
      `;
      recContainer.appendChild(item);
    } else {
      const item = document.createElement("div");
      item.className = "rec-item";
      item.innerHTML = `
        <i data-lucide="trending-up"></i>
        <p>
          ${t("rec_general_low")}
        </p>
      `;
      recContainer.appendChild(item);
    }
  }

  // Cargar modal con estilos
  const modal = document.getElementById("student-modal");
  if (modal) {
    modal.classList.add("active");
  }

  // Recargar iconos en modal
  lucide.createIcons();
}

function populateSubjectDetails(subj) {
  document.getElementById("modal-detail-materia-name").textContent = subj.materia;
  document.getElementById("modal-detail-materia-grade").textContent = subj.calculatedFinal.toFixed(2);
  document.getElementById("modal-detail-materia-teacher").textContent = subj.docente;
  document.getElementById("modal-detail-materia-group").textContent = subj.grupo;
  document.getElementById("modal-detail-materia-labs-avg").textContent = subj.calculatedPromLab.toFixed(2);
  document.getElementById("modal-detail-materia-pars-avg").textContent = subj.calculatedPromPar.toFixed(2);

  const setGradeSubCardState = (elId, val) => {
    const card = document.getElementById(elId);
    const textVal = document.getElementById("modal-val-" + elId.replace("modal-card-", ""));
    if (!card || !textVal) return;
    textVal.textContent = val.toFixed(1);
    
    card.className = "grade-sub-card";
    if (val < state.config.thresholdFail) {
      card.classList.add("reprobado");
    } else if (val < state.config.thresholdCum) {
      card.classList.add("cum-warning");
    } else {
      card.classList.add("aprobado");
    }
  };

  setGradeSubCardState("modal-card-lab-1", subj.lab1);
  setGradeSubCardState("modal-card-lab-2", subj.lab2);
  setGradeSubCardState("modal-card-lab-3", subj.lab3);
  setGradeSubCardState("modal-card-lab-4", subj.lab4);

  setGradeSubCardState("modal-card-par-1", subj.par1);
  setGradeSubCardState("modal-card-par-2", subj.par2);
  setGradeSubCardState("modal-card-par-3", subj.par3);
  setGradeSubCardState("modal-card-par-4", subj.par4);
}

function clearSubjectDetails() {
  document.getElementById("modal-detail-materia-name").textContent = "Sin materias";
  document.getElementById("modal-detail-materia-grade").textContent = "0.00";
  document.getElementById("modal-detail-materia-teacher").textContent = "-";
  document.getElementById("modal-detail-materia-group").textContent = "-";
  document.getElementById("modal-detail-materia-labs-avg").textContent = "0.00";
  document.getElementById("modal-detail-materia-pars-avg").textContent = "0.00";

  const clearSubCard = (elId) => {
    const card = document.getElementById(elId);
    const textVal = document.getElementById("modal-val-" + elId.replace("modal-card-", ""));
    if (card && textVal) {
      textVal.textContent = "0.0";
      card.className = "grade-sub-card";
    }
  };

  clearSubCard("modal-card-lab-1");
  clearSubCard("modal-card-lab-2");
  clearSubCard("modal-card-lab-3");
  clearSubCard("modal-card-lab-4");
  clearSubCard("modal-card-par-1");
  clearSubCard("modal-card-par-2");
  clearSubCard("modal-card-par-3");
  clearSubCard("modal-card-par-4");
}

// Cerrar Modal
function closeModal() {
  document.getElementById("student-modal").classList.remove("active");
}

// GENERAR RECOMENDACIONES DINAMICAMENTE PARA ESTUDIANTE AGRUPADO
function generateRecommendations(student) {
  const container = document.getElementById("modal-recommendations-container");
  if (!container) return;
  container.innerHTML = "";

  const recs = [];

  if (student.riskLevel === "high") {
    recs.push({
      icon: "help-circle",
      text: t("rec_high_permanence")
    });

    let failingLabsSum = 0;
    let failingParsSum = 0;
    
    student.subjects.forEach(subj => {
      const subjFailingLabs = [subj.lab1, subj.lab2, subj.lab3, subj.lab4].filter(g => g < state.config.thresholdFail).length;
      const subjFailingPars = [subj.par1, subj.par2, subj.par3, subj.par4].filter(g => g < state.config.thresholdFail).length;
      
      if (subjFailingLabs >= 2) failingLabsSum++;
      if (subjFailingPars >= 2) failingParsSum++;
    });

    if (failingLabsSum > 0) {
      recs.push({
        icon: "flask",
        text: t("rec_practice_labs")
      });
    }

    if (failingParsSum > 0) {
      recs.push({
        icon: "book-open",
        text: t("rec_theory_exams")
      });
    }
  } else if (student.riskLevel === "medium") {
    recs.push({
      icon: "trending-up",
      text: t("rec_elevate_avg")
    });

    let needsTheoryRefinement = false;
    let needsPracticeRefinement = false;
    student.subjects.forEach(subj => {
      if (subj.calculatedPromLab < subj.calculatedPromPar) {
        needsPracticeRefinement = true;
      } else {
        needsTheoryRefinement = true;
      }
    });

    if (needsPracticeRefinement) {
      recs.push({
        icon: "sliders",
        text: t("rec_focus_labs")
      });
    }
    if (needsTheoryRefinement) {
      recs.push({
        icon: "file-text",
        text: t("rec_focus_exams")
      });
    }
  } else {
    recs.push({
      icon: "award",
      text: t("rec_low_risk")
    });
  }

  recs.forEach(rec => {
    const div = document.createElement("div");
    div.className = "rec-item";
    div.innerHTML = `
      <i data-lucide="${rec.icon}"></i>
      <p>${rec.text}</p>
    `;
    container.appendChild(div);
  });
}

// Cargar Datos Demo desde esta página
function loadDemoData() {
  showLoader("Generando matriz de calificaciones estudiantiles simulada...");

  setTimeout(() => {
    const demoRawRows = [];
    const materias = [
      { name: "Álgebra Vectorial", prof: "Dr. Jorge Valdivia" },
      { name: "Programación Orientada a Objetos", prof: "Ing. Carlos Benítez" },
      { name: "Estructura de Datos", prof: "Dra. Elena Rostova" },
      { name: "Física Mecánica", prof: "Lic. Sofía Alvarenga" },
      { name: "Macroeconomía Básica", prof: "Dra. Lucía Méndez" }
    ];
    const carreras = ["010306", "010315", "010318", "010321", "010325", "010332", "010801", "010803", "010805", "010807", "010808", "010811", "010812", "010813", "010814"];
    
    // Nombres y Apellidos comunes en español para realismo
    const nombres = [
      "Sofía", "Mateo", "Valentina", "Santiago", "Camila", "Sebastián", "Isabella", 
      "Alejandro", "Mariana", "Diego", "Gabriela", "Nicolás", "Daniela", "Samuel",
      "Martina", "Lucas", "Lucía", "Benjamín", "Valeria", "Emilio", "Andrea", "Felipe"
    ];
    const apellidos = [
      "González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", 
      "Pérez", "García", "Sánchez", "Romero", "Álvarez", "Torres", "Ruiz", "Ramírez",
      "Flores", "Acosta", "Benítez", "Medina", "Herrera", "Castro", "Vargas", "Rojas"
    ];

    const generateIdString = (idx) => {
      const year = "2024";
      const seq = String(idx).padStart(4, '0');
      return `${year}-${seq}`;
    };

    // Generar un pool de 40 estudiantes únicos
    const studentPool = [];
    for (let i = 1; i <= 45; i++) {
      const nom = nombres[Math.floor(Math.random() * nombres.length)];
      const ape = apellidos[Math.floor(Math.random() * apellidos.length)] + " " + apellidos[Math.floor(Math.random() * apellidos.length)];
      const carr = carreras[Math.floor(Math.random() * carreras.length)];
      
      // Simular perfiles para obtener una distribución real
      let profileType = "safe"; // safe, warning, failing
      const rand = Math.random();
      if (rand < 0.22) {
        profileType = "failing"; // 22% reprobación
      } else if (rand < 0.52) {
        profileType = "warning"; // 30% alerta CUM
      }

      studentPool.push({
        carnet: generateIdString(i),
        nombres: nom,
        apellidos: ape,
        carrera: carr,
        profileType: profileType
      });
    }

    // Inscribir a cada estudiante en 3 o 4 materias aleatorias
    studentPool.forEach(std => {
      const numSubjects = Math.floor(Math.random() * 2) + 3; // 3 o 4 asignaturas
      const shuffledMaterias = [...materias].sort(() => 0.5 - Math.random());
      const selected = shuffledMaterias.slice(0, numSubjects);

      selected.forEach(matInfo => {
        let lab1, lab2, lab3, lab4, par1, par2, par3, par4;
        
        if (std.profileType === "failing") {
          // Notas bajas, entre 2.0 y 5.8 (algunas reprobando, algunas pasadas raspando)
          const isFailSubject = Math.random() < 0.6;
          if (isFailSubject) {
            lab1 = Math.random() * 3.5 + 2.5; lab2 = Math.random() * 3.0 + 3.0; lab3 = Math.random() * 3.5 + 2.0; lab4 = Math.random() * 4.0 + 1.8;
            par1 = Math.random() * 3.0 + 2.0; par2 = Math.random() * 3.5 + 2.0; par3 = Math.random() * 3.0 + 1.5; par4 = Math.random() * 2.5 + 2.0;
          } else {
            lab1 = Math.random() * 2.0 + 5.5; lab2 = Math.random() * 1.5 + 6.0; lab3 = Math.random() * 2.0 + 5.5; lab4 = Math.random() * 1.8 + 6.0;
            par1 = Math.random() * 2.0 + 5.0; par2 = Math.random() * 2.0 + 5.5; par3 = Math.random() * 2.5 + 4.5; par4 = Math.random() * 2.0 + 5.0;
          }
        } else if (std.profileType === "warning") {
          // Notas entre 5.8 y 6.9
          lab1 = Math.random() * 2.0 + 6.0; lab2 = Math.random() * 1.5 + 6.2; lab3 = Math.random() * 2.0 + 5.5; lab4 = Math.random() * 1.8 + 6.0;
          par1 = Math.random() * 2.0 + 5.0; par2 = Math.random() * 2.0 + 5.8; par3 = Math.random() * 2.5 + 4.5; par4 = Math.random() * 2.0 + 5.0;
        } else {
          // Alumnos estables, notas de 7.0 a 10.0
          lab1 = Math.random() * 2.5 + 7.5; lab2 = Math.random() * 2.0 + 8.0; lab3 = Math.random() * 2.5 + 7.5; lab4 = Math.random() * 3.0 + 7.0;
          par1 = Math.random() * 2.5 + 7.0; par2 = Math.random() * 2.0 + 8.0; par3 = Math.random() * 3.0 + 7.0; par4 = Math.random() * 2.5 + 7.5;
        }

        demoRawRows.push({
          Docente: matInfo.prof,
          Materia: matInfo.name,
          Grupo: "0" + (Math.floor(Math.random() * 2) + 1),
          Carnet: std.carnet,
          Apellidos: std.apellidos,
          Nombres: std.nombres,
          "Código Carrera": std.carrera,
          "Lab #1": Math.round(lab1 * 10) / 10,
          "Par #1": Math.round(par1 * 10) / 10,
          "Lab #2": Math.round(lab2 * 10) / 10,
          "Par #2": Math.round(par2 * 10) / 10,
          "Lab #3": Math.round(lab3 * 10) / 10,
          "Par #3": Math.round(par3 * 10) / 10,
          "Lab #4": Math.round(lab4 * 10) / 10,
          "Par #4": Math.round(par4 * 10) / 10
        });
      });
    });

    // Agrupar y calcular métricas
    state.students = groupAndCalculateStudents(demoRawRows, state.config);
    
    // Persistir datos
    persistData();
    populateFilterDropdowns();

    document.getElementById("search-students").value = "";
    document.getElementById("filter-risk").value = "all";
    document.getElementById("filter-carrera").value = "all";
    document.getElementById("filter-materia").value = "all";
    document.getElementById("filter-docente").value = "all";

    hideLoader();
    filterAndRenderStudents();
    
    alert("Datos de demostración cargados exitosamente (" + state.students.length + " estudiantes únicos inscritos en múltiples materias).");
  }, 600);
}

// Descargar plantilla
function downloadTemplateCSV() {
  const headers = REQUIRED_COLUMNS.join(";");
  const rows = [
    "Ing. Carlos Benítez;Programación Orientada a Objetos;01;2024-0001;González Pérez;Mateo;ING01;7.5;8.0;6.8;7.2;8.0;7.5;9.0;8.5;7.825;7.8;7.81",
    "Dra. Elena Rostova;Estructura de Datos;02;2024-0002;Rodríguez Gómez;Sofía;ING01;5.5;6.0;6.2;5.5;5.0;6.2;5.8;4.8;5.375;5.625;5.5",
    "Dr. Jorge Valdivia;Álgebra Vectorial;01;2024-0003;Gómez Fernández;Lucas;ING02;6.8;6.2;6.5;6.8;6.0;6.1;7.0;6.5;6.575;6.4;6.49"
  ];
  const csvContent = headers + "\n" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "plantilla_estudiantes.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// CONTROL DE TEMA CLARO / OSCURO
function setupThemeToggle() {
  const btnTheme = document.getElementById("theme-toggle");
  if (btnTheme) {
    btnTheme.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
      const isLight = document.body.classList.contains("light-theme");
      localStorage.setItem("atenas_theme", isLight ? "light" : "dark");
      updateThemeIcon();
    });
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const iconEl = document.getElementById("theme-toggle-icon");
  if (!iconEl) return;
  const isLight = document.body.classList.contains("light-theme");
  iconEl.setAttribute("data-lucide", isLight ? "moon" : "sun");
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Normalizar texto para comparaciones robustas
function normalizeStr(str) {
  if (!str) return "";
  return str.toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Ordenar estudiantes filtrados según la columna y dirección seleccionadas
function sortFilteredStudents() {
  const col = state.sortColumn;
  const dir = state.sortDirection === "asc" ? 1 : -1;

  state.filteredStudents.sort((a, b) => {
    let valA, valB;

    if (col === "student") {
      valA = `${a.apellidos}, ${a.nombres}`.toLowerCase();
      valB = `${b.apellidos}, ${b.nombres}`.toLowerCase();
      return valA.localeCompare(valB) * dir;
    } else if (col === "carrera") {
      valA = (CAREER_NAMES[a.carrera] || a.carrera).toLowerCase();
      valB = (CAREER_NAMES[b.carrera] || b.carrera).toLowerCase();
      return valA.localeCompare(valB) * dir;
    } else if (col === "subjects") {
      valA = a.subjects.length;
      valB = b.subjects.length;
      return (valA - valB) * dir;
    } else if (col === "grade") {
      valA = a.calculatedFinal;
      valB = b.calculatedFinal;
      return (valA - valB) * dir;
    } else if (col === "risk") {
      const riskWeight = { "high": 3, "medium": 2, "low": 1 };
      valA = riskWeight[a.riskLevel] || 1;
      valB = riskWeight[b.riskLevel] || 1;
      return (valA - valB) * dir;
    }
    return 0;
  });
}

// Actualizar los iconos de ordenamiento en las cabeceras de la tabla
function updateSortIcons() {
  const headers = document.querySelectorAll("#main-students-table thead tr th");
  if (!headers || headers.length < 5) return;

  const sortableColumns = [
    { index: 0, key: "student" },
    { index: 1, key: "carrera" },
    { index: 2, key: "subjects" },
    { index: 3, key: "grade" },
    { index: 4, key: "risk" }
  ];

  sortableColumns.forEach(col => {
    const th = headers[col.index];
    if (!th) return;
    const iconSpan = th.querySelector(".sort-icon");
    if (!iconSpan) return;

    if (state.sortColumn === col.key) {
      iconSpan.style.color = "var(--color-primary, #6366f1)";
      if (state.sortDirection === "asc") {
        iconSpan.innerHTML = '<i data-lucide="chevron-up" style="width: 14px; height: 14px;"></i>';
      } else {
        iconSpan.innerHTML = '<i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>';
      }
    } else {
      iconSpan.style.color = "var(--text-muted, #888)";
      iconSpan.innerHTML = '<i data-lucide="chevrons-up-down" style="width: 14px; height: 14px;"></i>';
    }
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Configurar ordenamiento por clic en cabeceras
function setupHeaderSorting() {
  const headers = document.querySelectorAll("#main-students-table thead tr th");
  if (!headers || headers.length < 5) return;

  const sortableColumns = [
    { index: 0, key: "student" },
    { index: 1, key: "carrera" },
    { index: 2, key: "subjects" },
    { index: 3, key: "grade" },
    { index: 4, key: "risk" }
  ];

  // Inyectar estilos para el hover de cabeceras una única vez
  if (!document.getElementById("sort-header-styles")) {
    const style = document.createElement("style");
    style.id = "sort-header-styles";
    style.textContent = `
      #main-students-table thead tr th {
        transition: background-color 0.2s ease, color 0.2s ease;
      }
      #main-students-table thead tr th:hover {
        background-color: rgba(255, 255, 255, 0.05) !important;
        color: var(--text-highlight, #fff) !important;
      }
    `;
    document.head.appendChild(style);
  }

  sortableColumns.forEach(col => {
    const th = headers[col.index];
    if (!th) return;

    th.style.cursor = "pointer";
    th.style.userSelect = "none";
    
    let iconSpan = th.querySelector(".sort-icon");
    if (!iconSpan) {
      iconSpan = document.createElement("span");
      iconSpan.className = "sort-icon";
      iconSpan.style.marginLeft = "6px";
      iconSpan.style.display = "inline-flex";
      iconSpan.style.verticalAlign = "middle";
      iconSpan.style.transition = "transform 0.2s ease, color 0.2s ease";
      th.appendChild(iconSpan);
    }

    // Clonar elemento para remover listeners anteriores si existieran
    const newTh = th.cloneNode(true);
    th.parentNode.replaceChild(newTh, th);
  });

  // Re-obtener los headers actualizados y vincular eventos
  const freshHeaders = document.querySelectorAll("#main-students-table thead tr th");
  sortableColumns.forEach(col => {
    const th = freshHeaders[col.index];
    if (!th) return;

    th.addEventListener("click", () => {
      if (state.sortColumn === col.key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortColumn = col.key;
        state.sortDirection = "asc";
      }

      sortFilteredStudents();
      updateSortIcons();
      renderStudentsTable();
    });
  });

  updateSortIcons();
}

window.addEventListener("languagechange", () => {
  filterAndRenderStudents();
});


