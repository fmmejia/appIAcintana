/* ==========================================================================
   DASHBOARD DE DESERCION ESTUDIANTIL - LOGICA DE NEGOCIO (app.js)
   ========================================================================== */

// Configuración Global y Variables de Estado
const state = {
  students: [],          // Almacena la lista de estudiantes procesados
  filteredStudents: [],  // Lista filtrada por la búsqueda y dropdowns
  currentPage: 1,
  pageSize: 10,
  charts: {
    riskDist: null,
    careerAlerts: null,
    gradesHist: null
  },
  config: {
    thresholdFail: 6.0,   // Umbral de reprobación (Riesgo Alto)
    thresholdCum: 7.0,    // Umbral meta CUM de egreso (Riesgo Medio)
    weightLab: 0.4,       // Peso de Laboratorios (40% fijo)
    weightPar: 0.6        // Peso de Parciales (60% fijo)
  }
};

// Nombres de Carreras Mapeadas (Para fines visuales bonitos en el dashboard)
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

// Inicialización de la Aplicación al Cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar Iconos Lucide
  lucide.createIcons();

  // Asegurar que las configuraciones de periodo por defecto estén inicializadas
  getPeriodsConfig();
  getActivePeriod();
  
  // Cargar datos persistidos desde localStorage
  loadPersistedData();
  
  // Sincronizar inputs de configuración con el estado cargado
  syncConfigInputs();
  
  // Registrar Event Listeners
  setupEventListeners();

  // Inicializar control de tema claro/oscuro
  setupThemeToggle();

  // Inicializar selector global de periodos
  initGlobalPeriodSelector((newPeriod) => {
    loadPersistedData();
    const hasData = state.students.length > 0;
    
    handleHashRoute();
    
    if (hasData) {
      updateDashboardUI();
    }
    updateCalendarWidgetUI();
  });

  // Ejecutar el enrutador basado en hash para las pestañas de index.html
  handleHashRoute();
  window.addEventListener("hashchange", handleHashRoute);
  
  // Si hay datos cargados, actualizar el Dashboard y el widget
  const hasData = state.students.length > 0;

  
  if (hasData) {
    updateDashboardUI();
  }
  updateCalendarWidgetUI();
});

// Sincronizar los textos de configuración en el DOM con el estado real
function syncConfigInputs() {
  const thresholdFail = 6.0;
  const thresholdCum = 7.0;

  // También actualizar los textos del KPI
  const kpiFail = document.getElementById("kpi-fail-threshold");
  if (kpiFail) kpiFail.textContent = thresholdFail.toFixed(1);

  const kpiWarnLow = document.getElementById("kpi-warn-low");
  if (kpiWarnLow) kpiWarnLow.textContent = thresholdFail.toFixed(1);

  const kpiWarnHigh = document.getElementById("kpi-warn-high");
  if (kpiWarnHigh) kpiWarnHigh.textContent = (thresholdCum - 0.1).toFixed(1);
}

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

    // Filtrar por el periodo activo y calcular métricas correspondientes
    state.students = allStudents.filter(s => s.periodo === activePeriod);
    state.students.forEach(student => {
      calculateStudentMetrics(student, state.config, periodConfig);
    });
  } else {
    state.students = [];
  }
}

// Escuchar cambios en localStorage desde otras pestañas/páginas
window.addEventListener("storage", (e) => {
  if (e.key === "atenas_students" || e.key === "atenas_config") {
    loadPersistedData();
    syncConfigInputs();
    handleHashRoute();
    if (state.students.length > 0) {
      updateDashboardUI();
    }
  }
  if (e.key === "atenas_theme") {
    const isLight = e.newValue === "light";
    if (isLight) {
      document.body.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
    }
    updateThemeIcon();
    if (state.students.length > 0) {
      renderCharts();
    }
  }
});

// Guardar datos en localStorage
function persistData() {
  localStorage.setItem("atenas_config", JSON.stringify(state.config));
  localStorage.setItem("atenas_students", JSON.stringify(state.students));
}

// Manejar el enrutamiento de pestañas basado en hash (#configuracion) en index.html
function handleHashRoute() {
  const hash = window.location.hash;
  const navResumen = document.getElementById("nav-resumen");
  const navConfiguracion = document.getElementById("nav-configuracion");
  const viewResumen = document.getElementById("view-resumen");
  const viewConfiguracion = document.getElementById("view-configuracion");
  const emptySection = document.getElementById("empty-state-section");

  if (navResumen) navResumen.classList.remove("active");
  if (navConfiguracion) navConfiguracion.classList.remove("active");
  if (viewResumen) viewResumen.classList.remove("active");
  if (viewConfiguracion) viewConfiguracion.classList.remove("active");

  if (hash === "#configuracion") {
    if (navConfiguracion) navConfiguracion.classList.add("active");
    if (viewConfiguracion) {
      viewConfiguracion.classList.add("active");
      viewConfiguracion.style.display = "block";
    }
    if (viewResumen) viewResumen.style.display = "none";
    if (emptySection) emptySection.style.display = "none";
    updateHeaderTitle("view-configuracion");
  } else {
    // Por defecto es Resumen General
    if (navResumen) navResumen.classList.add("active");
    if (viewConfiguracion) viewConfiguracion.style.display = "none";
    
    if (state.students.length > 0) {
      if (viewResumen) {
        viewResumen.classList.add("active");
        viewResumen.style.display = "block";
      }
      if (emptySection) emptySection.style.display = "none";
    } else {
      if (viewResumen) viewResumen.style.display = "none";
      if (emptySection) emptySection.style.display = "flex";
    }
    updateHeaderTitle("view-resumen");
  }
}

// Registrar los Event Listeners de la Interfaz
function setupEventListeners() {
  // Botón Cerrar Modal
  const btnCloseModal = document.getElementById("btn-close-modal");
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);
  
  const studentModal = document.getElementById("student-modal");
  if (studentModal) {
    studentModal.addEventListener("click", (e) => {
      if (e.target.id === "student-modal") closeModal();
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

// Actualiza los Títulos del Header según la pestaña activa
function updateHeaderTitle(targetId) {
  const titleEl = document.getElementById("page-title");
  const subEl = document.getElementById("page-subtitle");
  
  if (!state.students.length) {
    titleEl.textContent = t("hdr_default_title");
    subEl.textContent = t("hdr_default_sub");
    return;
  }

  switch(targetId) {
    case "view-resumen":
      titleEl.textContent = t("hdr_dashboard_title");
      subEl.textContent = t("hdr_dashboard_sub");
      break;
    case "view-estudiantes":
      titleEl.textContent = t("hdr_students_title");
      subEl.textContent = t("hdr_students_sub");
      break;
    case "view-configuracion":
      titleEl.textContent = t("hdr_config_title");
      subEl.textContent = t("hdr_config_sub");
      break;
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
  if (loaderText) loaderText.textContent = text;
  
  const loaderContainer = document.getElementById("loader-container");
  if (loaderContainer) loaderContainer.style.display = "flex";
  
  const emptyState = document.getElementById("empty-state-section");
  if (emptyState) emptyState.style.display = "none";
  
  const viewResumen = document.getElementById("view-resumen");
  if (viewResumen) viewResumen.style.display = "none";
  
  const viewEstudiantes = document.getElementById("view-estudiantes");
  if (viewEstudiantes) viewEstudiantes.style.display = "none";
  
  const viewConfiguracion = document.getElementById("view-configuracion");
  if (viewConfiguracion) viewConfiguracion.style.display = "none";
}

function hideLoader() {
  const loaderContainer = document.getElementById("loader-container");
  if (loaderContainer) loaderContainer.style.display = "none";
  
  // Mostrar la vista activa
  const activeNavItem = document.querySelector(".nav-menu .nav-item.active");
  if (activeNavItem) {
    const targetId = activeNavItem.getAttribute("data-target");
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.style.display = "block";
  }
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
      document.getElementById("empty-state-section").style.display = "flex";
      alert("Formato de archivo no soportado. Por favor, cargue un archivo .csv, .xlsx o .xls");
    }
  }, 500);
}

// Analizar archivo CSV usando PapaParse con auto-detección de codificación (UTF-8 / Windows-1252)
function parseCSV(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const arrayBuffer = e.target.result;
    let text;
    try {
      // Intentar decodificar como UTF-8 estricto
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      text = utf8Decoder.decode(arrayBuffer);
    } catch (err) {
      // Si falla (ej: tiene caracteres con codificación ANSI/Windows-1252), decodificar con Windows-1252
      const winDecoder = new TextDecoder('windows-1252');
      text = winDecoder.decode(arrayBuffer);
    }
    
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: function(results) {
        handleParsedRows(results.data);
      },
      error: function(err) {
        hideLoader();
        const emptyState = document.getElementById("empty-state-section");
        if (emptyState) emptyState.style.display = "flex";
        alert("Error al parsear el archivo CSV: " + err.message);
      }
    });
  };
  reader.onerror = function() {
    hideLoader();
    const emptyState = document.getElementById("empty-state-section");
    if (emptyState) emptyState.style.display = "flex";
    alert("Error al leer el archivo CSV.");
  };
  reader.readAsArrayBuffer(file);
}

// Analizar archivo Excel usando SheetJS (XLSX)
function parseExcel(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Tomamos la primera hoja
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convertir a JSON utilizando la fila de encabezados
      // Dado que el usuario especificó separador por punto y coma, SheetJS suele interpretar correctamente las celdas individuales en XLS/XLSX
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      
      handleParsedRows(jsonData);
    } catch (err) {
      hideLoader();
      document.getElementById("empty-state-section").style.display = "flex";
      alert("Error al procesar el archivo Excel: " + err.message);
    }
  };
  reader.onerror = function() {
    hideLoader();
    document.getElementById("empty-state-section").style.display = "flex";
    alert("Error al leer el archivo del dispositivo.");
  };
  reader.readAsArrayBuffer(file);
}

// Manejar los datos crudos extraídos del archivo
function handleParsedRows(rawRows) {
  if (!rawRows || rawRows.length === 0) {
    hideLoader();
    document.getElementById("empty-state-section").style.display = "flex";
    alert("El archivo está vacío o no se pudo extraer ninguna fila.");
    return;
  }

  // Sanitizar encabezados por si tienen espacios en blanco extras
  const firstRow = rawRows[0];
  const keys = Object.keys(firstRow).map(k => k.trim());
  
  // Validar si contiene columnas críticas (ej: Carnet, Nombres, Nota Final o los Labs/Parciales para recalcular)
  const hasCarnet = keys.some(k => k.toLowerCase().includes("carnet"));
  const hasNombres = keys.some(k => k.toLowerCase().includes("nombre"));
  const hasNotaFinal = keys.some(k => k.toLowerCase().includes("nota final") || k.toLowerCase().includes("prom"));

  if (!hasCarnet || !hasNombres) {
    hideLoader();
    document.getElementById("empty-state-section").style.display = "flex";
    alert("Estructura de columnas inválida. Asegúrese de que el archivo contenga las columnas básicas: 'Carnet', 'Nombres', 'Apellidos'.");
    return;
  }

  // Agrupar filas duplicadas por estudiante (Carnet) e inyectar su historial
  state.students = groupAndCalculateStudents(rawRows, state.config);
  
  // Guardar datos en localStorage para que estén disponibles en estudiantes.html
  persistData();

  // Enrutar al resumen
  window.location.hash = "resumen";

  hideLoader();
  updateDashboardUI();
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

// ACTUALIZACIÓN DE LA UI DEL DASHBOARD
function updateDashboardUI() {
  // Asegurar que la pantalla de estado vacío se oculte
  const emptySection = document.getElementById("empty-state-section");
  if (emptySection) emptySection.style.display = "none";
  
  // Calcular métricas agregadas
  const total = state.students.length;
  if (total === 0) return;

  const highRiskList = state.students.filter(s => s.riskLevel === "high");
  const mediumRiskList = state.students.filter(s => s.riskLevel === "medium");
  const averageGrade = state.students.reduce((sum, s) => sum + s.calculatedFinal, 0) / total;

  // Actualizar valores de KPIs con transiciones animadas de texto
  animateValue("kpi-total-students", 0, total, 800);
  animateValue("kpi-high-risk", 0, highRiskList.length, 800);
  animateValue("kpi-cum-warning", 0, mediumRiskList.length, 800);
  
  const avgGradeEl = document.getElementById("kpi-average-grade");
  if (avgGradeEl) avgGradeEl.textContent = averageGrade.toFixed(2);
  
  // Subtexto dinámico para promedio general
  const subTextEl = document.getElementById("kpi-average-sub");
  if (subTextEl) {
    if (averageGrade >= state.config.thresholdCum) {
      subTextEl.innerHTML = t("kpi_sub_satisfactory");
    } else if (averageGrade >= state.config.thresholdFail) {
      subTextEl.innerHTML = t("kpi_sub_low");
    } else {
      subTextEl.innerHTML = t("kpi_sub_critical");
    }
  }

  // Actualizar lista de Top 5 estudiantes en riesgo
  updateTopRiskList(highRiskList.length ? highRiskList : [...mediumRiskList].sort((a,b) => b.riskScore - a.riskScore));

  // Renderizar Gráficos interactivos
  renderCharts();
  
  // Asegurar que el título superior corresponda a la vista activa
  const activeNavItem = document.querySelector(".nav-menu .nav-item.active");
  if (activeNavItem) {
    updateHeaderTitle(activeNavItem.getAttribute("data-target"));
  }
}

// Efecto de Conteo Animado en los KPIs (Optimizado y con duración fija usando requestAnimationFrame)
function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  
  if (start === end) {
    obj.textContent = end;
    return;
  }
  
  let startTime = null;
  
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const currentValue = Math.floor(progress * (end - start) + start);
    obj.textContent = currentValue;
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.textContent = end;
    }
  }
  
  window.requestAnimationFrame(step);
}

// Actualizar Tabla del Top 5 Alumnos Críticos
function updateTopRiskList(candidates) {
  const tbody = document.getElementById("top-risk-students-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  // Ordenar candidatos por su puntaje de riesgo de mayor a menor
  const sorted = [...candidates].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5);
  
  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay estudiantes bajo riesgo detectado</td></tr>`;
    return;
  }

  sorted.forEach(student => {
    const tr = document.createElement("tr");
    
    // Badge de estado
    let badgeClass = "badge-risk-high";
    let badgeLabel = "Reprobado";
     if (student.riskLevel === "medium") {
       badgeClass = "badge-risk-medium";
       badgeLabel = "Alerta Promedio";
     }

    tr.innerHTML = `
      <td>
        <div class="td-student-info">
          <span class="student-name">${student.apellidos}, ${student.nombres}</span>
          <span class="student-carnet">${student.carnet}</span>
        </div>
      </td>
      <td><span style="font-family: monospace; font-weight: 500;">${student.carrera}</span></td>
      <td style="font-weight: 600; font-family: monospace;">${student.calculatedFinal.toFixed(2)}</td>
      <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
      <td style="text-align: center;">
        <button class="btn-action-view" onclick="openStudentModal('${student.id}')">
          <i data-lucide="external-link"></i> Ver
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Volver a vincular iconos de Lucide cargados
  lucide.createIcons();
}

// RENDERIZAR GRÁFICOS (CHART.JS)
function renderCharts() {
  const total = state.students.length;
  if (!total) return;

  const highCount = state.students.filter(s => s.riskLevel === "high").length;
  const mediumCount = state.students.filter(s => s.riskLevel === "medium").length;
  const lowCount = state.students.filter(s => s.riskLevel === "low").length;

  // Detectar tema claro para ajustar colores de Chart.js
  const isLight = document.body.classList.contains("light-theme");
  const textColor = isLight ? '#4b5563' : '#9ca3af';
  const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
  const doughnutBorderColor = isLight ? '#ffffff' : '#0f131f';

  // --- Gráfico 1: Dona - Distribución de Riesgo ---
  const ctxRisk = document.getElementById("chart-risk-distribution").getContext("2d");
  if (state.charts.riskDist) state.charts.riskDist.destroy(); // Destruir instancia previa
  
  state.charts.riskDist = new Chart(ctxRisk, {
    type: 'doughnut',
    data: {
      labels: [
        t('risk_level_high') + ' (' + t('badge_risk_high') + ')',
        t('risk_level_medium') + ' (' + t('badge_risk_medium') + ')',
        t('risk_level_low') + ' (' + t('badge_risk_low') + ')'
      ],
      datasets: [{
        data: [highCount, mediumCount, lowCount],
        backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
        borderColor: doughnutBorderColor,
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 11 }
          }
        }
      },
      cutout: '65%'
    }
  });

  // --- Gráfico 2: Barras - Carreras con Mayor Alerta (High + Medium) ---
  // Agrupar por carrera y contar riesgos
  const careerDataMap = {};
  state.students.forEach(student => {
    const c = student.carrera;
    if (!careerDataMap[c]) {
      careerDataMap[c] = { careerCode: c, high: 0, medium: 0, totalAlerts: 0 };
    }
    
    if (student.riskLevel === "high") {
      careerDataMap[c].high++;
      careerDataMap[c].totalAlerts++;
    } else if (student.riskLevel === "medium") {
      careerDataMap[c].medium++;
      careerDataMap[c].totalAlerts++;
    }
  });

  // Convertir a array, ordenar por total de alertas descendente
  const careerAlertsSorted = Object.values(careerDataMap)
    .sort((a, b) => b.totalAlerts - a.totalAlerts);

  const careerLabels = careerAlertsSorted.map(item => CAREER_NAMES[item.careerCode] || item.careerCode);
  const highRiskData = careerAlertsSorted.map(item => item.high);
  const mediumRiskData = careerAlertsSorted.map(item => item.medium);

  const ctxCareers = document.getElementById("chart-careers-alerts").getContext("2d");
  if (state.charts.careerAlerts) state.charts.careerAlerts.destroy();

  state.charts.careerAlerts = new Chart(ctxCareers, {
    type: 'bar',
    data: {
      labels: careerLabels,
      datasets: [
        {
          label: t('risk_level_high') + ' (' + t('badge_risk_high') + ')',
          data: highRiskData,
          backgroundColor: '#ef4444'
        },
        {
          label: t('risk_level_medium') + ' (' + t('badge_risk_medium') + ')',
          data: mediumRiskData,
          backgroundColor: '#f59e0b'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter' } }
        },
        y: {
          stacked: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Inter' }, stepSize: 1 }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'Inter', size: 11 } }
        }
      }
    }
  });

  // --- Gráfico 3: Histograma - Distribución de Notas Finales ---
  // Rango de 0 a 10 con intervalos de 0.5 o 1.0
  const binCount = 10;
  const bins = Array(binCount).fill(0);
  const binLabels = ["0-1", "1-2", "2-3", "3-4", "4-5", "5-6", "6-7", "7-8", "8-9", "9-10"];

  state.students.forEach(student => {
    const final = student.calculatedFinal;
    const index = Math.min(9, Math.floor(final));
    bins[index]++;
  });

  const ctxGrades = document.getElementById("chart-grades-histogram").getContext("2d");
  if (state.charts.gradesHist) state.charts.gradesHist.destroy();

  state.charts.gradesHist = new Chart(ctxGrades, {
    type: 'bar',
    data: {
      labels: binLabels,
      datasets: [{
        label: t('card_evaluated_students'),
        data: bins,
        backgroundColor: 'rgba(99, 102, 241, 0.45)',
        borderColor: '#6366f1',
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter' } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Inter' }, stepSize: 2 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `Alumnos: ${context.parsed.y}`;
            }
          }
        }
      }
    }
  });
}

// Las funciones de filtrado, renderiz// ABRIR Y LLENAR EL MODAL DETALLADO DE ESTUDIANTE (AGRUPADO)
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
    if ((subj.par3 < subj.par1 && subj.par3 < 6.0) || (subj.par4 < subj.par2 && subj.par4 < 6.0)) {
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

  if (diagCard) diagCard.className = `alert-indicator-card ${diagClass}`;
  if (diagIcon) diagIcon.setAttribute("data-lucide", student.riskLevel === "high" ? "alert-triangle" : (student.riskLevel === "medium" ? "alert-circle" : "check-circle"));
  if (diagTitle) diagTitle.textContent = titleText;
  if (diagDesc) diagDesc.textContent = descText;

  generateRecommendations(student);
  document.getElementById("student-modal").classList.add("active");
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

// GENERADOR DE DATOS DE SIMULACIÓN REALISTAS (CARGA DEMO)
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
    const carreras = ["ING01", "ING02", "ING03", "LIC01", "LIC02", "LIC03"];
    
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

    hideLoader();
    updateDashboardUI();
    
    // Alerta de éxito
    alert("Datos de demostración cargados exitosamente (" + state.students.length + " estudiantes únicos inscritos en múltiples materias).");
  }, 600);
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
      
      // Re-renderizar gráficos con los nuevos colores
      if (state.students.length > 0) {
        renderCharts();
      }
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

// Actualizar el widget de calendario en el dashboard
function updateCalendarWidgetUI() {
  const widget = document.getElementById("cycle-calendar-widget");
  if (!widget) return;

  const activePeriod = getActivePeriod();
  const periodsConfig = getPeriodsConfig();
  const periodConfig = periodsConfig[activePeriod];

  if (!periodConfig) {
    widget.style.display = "none";
    return;
  }
  widget.style.display = "flex";

  // Actualizar nombre y estado
  const nameEl = document.getElementById("widget-period-name");
  if (nameEl) nameEl.textContent = activePeriod;

  const statusEl = document.getElementById("widget-period-status");
  if (statusEl) {
    const isCompleted = periodConfig.status === "completed";
    statusEl.textContent = isCompleted ? t("widget_status_completed") : t("widget_status_active");
    statusEl.className = `status-badge ${isCompleted ? 'reprobado' : 'active'}`;
    statusEl.style.backgroundColor = isCompleted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    statusEl.style.color = isCompleted ? 'var(--color-risk-high)' : 'var(--color-risk-low)';
    statusEl.style.border = isCompleted ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)';
  }

  // Duración y semanas
  const weeksEl = document.getElementById("widget-period-weeks");
  const start = parseLocalDate(periodConfig.cycleStart);
  const end = parseLocalDate(periodConfig.cycleEnd);
  
  const targetDate = periodConfig.simulationDate ? parseLocalDate(periodConfig.simulationDate) : new Date();
  targetDate.setHours(0, 0, 0, 0);

  if (start && end && weeksEl) {
    const diffTime = targetDate - start;
    const courseWeek = Math.max(1, Math.ceil(diffTime / (7 * 24 * 60 * 60 * 1000)));
    const totalWeeks = Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
    
    const fmtStart = formatLocalDateToES(start);
    const fmtEnd = formatLocalDateToES(end);
    
    if (periodConfig.status === "completed") {
      weeksEl.textContent = t("completed_cycle_range", { start: fmtStart, end: fmtEnd });
    } else {
      if (targetDate < start) {
        weeksEl.textContent = t("upcoming_cycle", { start: fmtStart, end: fmtEnd });
      } else if (targetDate > end) {
        weeksEl.textContent = t("finished_cycle", { start: fmtStart, end: fmtEnd });
      } else {
        weeksEl.textContent = t("active_cycle_week", { week: courseWeek, total: totalWeeks, start: fmtStart, end: fmtEnd });
      }
    }
  }

  // Unidad evaluativa y progreso
  const unit = getCurrentUnit(periodConfig);
  const analysisUnit = getAnalysisUnit(periodConfig);
  const unitLabelEl = document.getElementById("widget-active-unit-label");
  const unitPercentEl = document.getElementById("widget-active-unit-percent");
  const progressBarEl = document.getElementById("widget-active-unit-progress-bar");

  if (unitLabelEl) {
    unitLabelEl.textContent = t("widget_unit_detail", { unit: analysisUnit });
  }
  
  let percent = 0;
  if (periodConfig.status === "completed") {
    percent = 100;
  } else if (start && end) {
    const totalTime = end - start;
    const elapsedTime = targetDate - start;
    if (totalTime > 0) {
      percent = Math.round(Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100)));
    }
  }

  if (unitPercentEl) {
    unitPercentEl.textContent = t("widget_percent_evaluated", { percent: percent });
  }
  if (progressBarEl) {
    progressBarEl.style.width = `${percent}%`;
  }

  // Cuenta regresiva / Alertas
  const countdownBox = document.getElementById("widget-countdown-box");
  const countdownTitle = document.getElementById("widget-countdown-title");
  const countdownDesc = document.getElementById("widget-countdown-desc");
  const countdownIcon = document.getElementById("widget-countdown-icon");

  if (countdownBox && countdownTitle && countdownDesc) {
    if (periodConfig.status === "completed") {
      countdownTitle.textContent = t("widget_closed_cycle");
      countdownDesc.textContent = t("widget_final_evals_closed");
      countdownBox.style.borderColor = "rgba(16, 185, 129, 0.2)";
      countdownBox.style.background = "rgba(16, 185, 129, 0.03)";
      if (countdownIcon) countdownIcon.setAttribute("data-lucide", "check-circle");
    } else {
      let unitEndDateStr = "";
      if (unit === 1) unitEndDateStr = periodConfig.unit1End;
      else if (unit === 2) unitEndDateStr = periodConfig.unit2End;
      else if (unit === 3) unitEndDateStr = periodConfig.unit3End;
      else if (unit === 4) unitEndDateStr = periodConfig.unit4End;

      const unitEnd = parseLocalDate(unitEndDateStr);
      if (unitEnd) {
        unitEnd.setHours(23, 59, 59, 999);
        const diffMs = unitEnd - targetDate;
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

        if (diffDays < 0) {
          countdownTitle.textContent = t("widget_unit_closed", { unit: unit });
          countdownDesc.textContent = t("widget_cutoff_completed");
          countdownBox.style.borderColor = "var(--glass-border)";
          countdownBox.style.background = "rgba(255, 255, 255, 0.01)";
          if (countdownIcon) countdownIcon.setAttribute("data-lucide", "calendar");
        } else {
          countdownTitle.textContent = t("widget_unit_deadline", { unit: unit });
          if (diffDays === 0) {
            countdownDesc.textContent = t("widget_closes_today");
            countdownBox.style.borderColor = "rgba(239, 68, 68, 0.4)";
            countdownBox.style.background = "rgba(239, 68, 68, 0.08)";
            if (countdownIcon) countdownIcon.setAttribute("data-lucide", "alert-triangle");
          } else {
            const daysText = t("widget_days_remaining", { days: diffDays }).replace("{s}", diffDays > 1 ? "s" : "");
            countdownDesc.textContent = daysText;
            if (diffDays <= 7) {
              countdownBox.style.borderColor = "rgba(245, 158, 11, 0.4)";
              countdownBox.style.background = "rgba(245, 158, 11, 0.08)";
              if (countdownIcon) countdownIcon.setAttribute("data-lucide", "clock");
            } else {
              countdownBox.style.borderColor = "var(--glass-border)";
              countdownBox.style.background = "rgba(255, 255, 255, 0.01)";
              if (countdownIcon) countdownIcon.setAttribute("data-lucide", "calendar");
            }
          }
        }
      } else {
        countdownTitle.textContent = t("widget_no_calendar");
        countdownDesc.textContent = t("widget_dates_undefined");
        if (countdownIcon) countdownIcon.setAttribute("data-lucide", "info");
      }
    }
  }

  lucide.createIcons();
}

// Auxiliar para formatear fecha a DD/MM/YYYY
function formatLocalDateToES(date) {
  if (!date) return "";
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

window.addEventListener("languagechange", () => {
  const hasData = state.students.length > 0;
  if (hasData) {
    updateDashboardUI();
  }
  updateCalendarWidgetUI();
});



