/* ==========================================================================
   GESTIÓN Y CARGA DE DATOS - LOGICA CENTRALIZADA (cargar.js)
   ========================================================================== */

// Configuración Global y Variables de Estado
const state = {
  students: [],
  config: {
    thresholdFail: 6.0,
    thresholdCum: 7.0,
    weightLab: 0.4,
    weightPar: 0.6
  }
};

const REQUIRED_COLUMNS = [
  "Docente", "Materia", "Grupo", "Carnet", "Apellidos", "Nombres", "Código Carrera",
  "Lab #1", "Par #1", "Lab #2", "Par #2", "Lab #3", "Par #3", "Lab #4", "Par #4",
  "Prom Lab", "Prom Par", "Nota Final"
];

// Inicialización de la página
document.addEventListener("DOMContentLoaded", () => {
  // Inicializar Iconos Lucide
  lucide.createIcons();

  // Asegurar que las configuraciones de periodo por defecto estén inicializadas
  getPeriodsConfig();
  getActivePeriod();

  // Cargar datos actuales
  loadPersistedData();

  // Registrar Event Listeners
  setupEventListeners();

  // Inicializar control de tema claro/oscuro
  setupThemeToggle();

  // Inicializar selectores de periodo
  initPeriodSelectors();

  // Actualizar Tarjeta de Estado de Base de Datos
  updateDatabaseStatusUI();
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
    state.students = JSON.parse(savedStudents);
  } else {
    state.students = [];
  }
}

// Guardar datos en localStorage
function persistData() {
  localStorage.setItem("atenas_students", JSON.stringify(state.students));
}

// Inicializar selectores de periodo de la página de carga
function initPeriodSelectors() {
  // 1. Selector global en cabecera
  initGlobalPeriodSelector((newPeriod) => {
    // Al cambiar el periodo global, cargamos sus fechas en el formulario de la derecha
    loadCalendarSettingsToForm(newPeriod);
    updateDatabaseStatusUI();
  });

  // 2. Selector en el formulario de importación
  updateImportPeriodSelect();

  // Cargar calendario para el periodo activo actual
  loadCalendarSettingsToForm(getActivePeriod());
}

// Actualizar las opciones de import-period-select
function updateImportPeriodSelect() {
  const importSelect = document.getElementById("import-period-select");
  if (!importSelect) return;

  const config = getPeriodsConfig();
  const activePeriod = getActivePeriod();

  importSelect.innerHTML = "";
  Object.keys(config).sort().forEach(periodName => {
    const opt = document.createElement("option");
    opt.value = periodName;
    opt.textContent = periodName;
    if (periodName === activePeriod) {
      opt.selected = true;
    }
    importSelect.appendChild(opt);
  });
}

// Cargar configuraciones del calendario al formulario
function loadCalendarSettingsToForm(periodName) {
  const config = getPeriodsConfig();
  const periodConfig = config[periodName];
  if (!periodConfig) return;

  const label = document.getElementById("calendar-period-label");
  const status = document.getElementById("cycle-status");
  const start = document.getElementById("cycle-start");
  const end = document.getElementById("cycle-end");
  const u1 = document.getElementById("unit1-end");
  const u2 = document.getElementById("unit2-end");
  const u3 = document.getElementById("unit3-end");
  const u4 = document.getElementById("unit4-end");
  const simDate = document.getElementById("simulation-date");

  if (label) label.textContent = periodName;
  if (status) status.value = periodConfig.status || "active";
  if (start) start.value = periodConfig.cycleStart || "";
  if (end) end.value = periodConfig.cycleEnd || "";
  if (u1) u1.value = periodConfig.unit1End || "";
  if (u2) u2.value = periodConfig.unit2End || "";
  if (u3) u3.value = periodConfig.unit3End || "";
  if (u4) u4.value = periodConfig.unit4End || "";
  if (simDate) simDate.value = periodConfig.simulationDate || "";
}

// Registrar los Event Listeners de la Interfaz
function setupEventListeners() {
  // Gatillo de Carga de Archivos (Drag & Drop Grande)
  const largeDropzone = document.getElementById("large-dropzone");
  const fileInputMain = document.getElementById("file-input-main");
  
  if (largeDropzone && fileInputMain) {
    largeDropzone.addEventListener("click", () => fileInputMain.click());
    fileInputMain.addEventListener("change", handleFileSelect);

    largeDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      largeDropzone.classList.add("dragover");
    });

    largeDropzone.addEventListener("dragleave", () => {
      largeDropzone.classList.remove("dragover");
    });

    largeDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      largeDropzone.classList.remove("dragover");
      if (e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Botón Cargar Datos Demo
  const btnDemo = document.getElementById("btn-load-demo");
  if (btnDemo) btnDemo.addEventListener("click", loadDemoData);

  // Botón Descargar Plantilla CSV
  const btnTemplate = document.getElementById("btn-download-template");
  if (btnTemplate) btnTemplate.addEventListener("click", downloadTemplateCSV);

  // Botón Limpiar Base de Datos
  const btnClearDb = document.getElementById("btn-clear-database");
  if (btnClearDb) btnClearDb.addEventListener("click", clearDatabase);

  // Botón crear nuevo ciclo/periodo
  const btnCreatePeriod = document.getElementById("btn-create-period");
  if (btnCreatePeriod) {
    btnCreatePeriod.addEventListener("click", () => {
      const name = prompt(t("prompt_create_cycle"));
      if (!name) return;
      const cleanName = name.trim();
      if (!cleanName) return;

      const config = getPeriodsConfig();
      if (config[cleanName]) {
        alert(t("err_cycle_exists", { name: cleanName }));
        return;
      }

      // Crear nuevo periodo con fechas por defecto basadas en el año digitado (si se deduce del nombre)
      let year = new Date().getFullYear();
      const match = cleanName.match(/\b(20\d{2})\b/);
      if (match) {
        year = parseInt(match[1]);
      }
      
      const isCiclo2 = cleanName.toLowerCase().includes("ciclo 2") || cleanName.toLowerCase().includes("ciclo ii") || cleanName.toLowerCase().includes("c2");
      
      config[cleanName] = {
        status: "active",
        cycleStart: isCiclo2 ? `${year}-07-20` : `${year}-02-01`,
        cycleEnd: isCiclo2 ? `${year}-12-15` : `${year}-06-30`,
        unit1End: isCiclo2 ? `${year}-08-25` : `${year}-03-05`,
        unit2End: isCiclo2 ? `${year}-09-30` : `${year}-04-10`,
        unit3End: isCiclo2 ? `${year}-11-05` : `${year}-05-15`,
        unit4End: isCiclo2 ? `${year}-12-10` : `${year}-06-20`,
        simulationDate: ""
      };

      savePeriodsConfig(config);
      
      // Actualizar selectores
      initGlobalPeriodSelector((newPeriod) => {
        loadCalendarSettingsToForm(newPeriod);
        updateDatabaseStatusUI();
      });
      updateImportPeriodSelect();

      // Autoseleccionar en los dropdowns
      const globalSelect = document.getElementById("global-period-select");
      if (globalSelect) {
        globalSelect.value = cleanName;
        globalSelect.dispatchEvent(new Event("change"));
      }
      const importSelect = document.getElementById("import-period-select");
      if (importSelect) {
        importSelect.value = cleanName;
      }

      alert(t("msg_cycle_created", { name: cleanName }));
    });
  }

  // Botón eliminar ciclo/periodo
  const btnDeletePeriod = document.getElementById("btn-delete-period");
  if (btnDeletePeriod) {
    btnDeletePeriod.addEventListener("click", () => {
      const importSelect = document.getElementById("import-period-select");
      if (!importSelect) return;
      
      const periodToDelete = importSelect.value;
      if (!periodToDelete) return;

      const config = getPeriodsConfig();
      const periodsList = Object.keys(config);

      if (periodsList.length <= 1) {
        alert(t("err_min_one_cycle"));
        return;
      }

      showConfirmModal(t("confirm_title_delete"), t("confirm_delete_cycle", { name: periodToDelete }), "danger")
        .then(confirmed => {
          if (confirmed) {
            // 1. Eliminar de la configuración
            delete config[periodToDelete];
            savePeriodsConfig(config);

            // 2. Eliminar estudiantes correspondientes a este periodo
            state.students = state.students.filter(s => s.periodo !== periodToDelete);
            persistData();

            // 3. Si el periodo eliminado era el activo, cambiar el activo
            const currentActive = getActivePeriod();
            if (currentActive === periodToDelete) {
              const remainingPeriods = Object.keys(config).sort();
              setActivePeriod(remainingPeriods[0]);
              
              // Sincronizar el selector global
              const globalSelect = document.getElementById("global-period-select");
              if (globalSelect) {
                globalSelect.value = remainingPeriods[0];
                globalSelect.dispatchEvent(new Event("change"));
              }
            }

            // 4. Actualizar selectores e interfaz
            initPeriodSelectors();
            updateDatabaseStatusUI();

            alert(t("msg_cycle_deleted", { name: periodToDelete }));
          }
        });
    });
  }

  // Botón guardar calendario
  const btnSaveCalendar = document.getElementById("btn-save-calendar");
  if (btnSaveCalendar) {
    btnSaveCalendar.addEventListener("click", () => {
      const activePeriod = getActivePeriod();
      const config = getPeriodsConfig();
      if (!config[activePeriod]) return;

      const status = document.getElementById("cycle-status").value;
      const start = document.getElementById("cycle-start").value;
      const end = document.getElementById("cycle-end").value;
      const u1 = document.getElementById("unit1-end").value;
      const u2 = document.getElementById("unit2-end").value;
      const u3 = document.getElementById("unit3-end").value;
      const u4 = document.getElementById("unit4-end").value;
      const simDate = document.getElementById("simulation-date").value;

      config[activePeriod] = {
        status: status,
        cycleStart: start,
        cycleEnd: end,
        unit1End: u1,
        unit2End: u2,
        unit3End: u3,
        unit4End: u4,
        simulationDate: simDate
      };

      savePeriodsConfig(config);

      // Recalcular notas de todos los estudiantes correspondientes a este periodo
      let recalculados = 0;
      state.students.forEach(student => {
        if (student.periodo === activePeriod) {
          calculateStudentMetrics(student, SYSTEM_CONFIG, config[activePeriod]);
          recalculados++;
        }
      });

      if (recalculados > 0) {
        persistData();
      }

      updateDatabaseStatusUI();
      alert(t("msg_calendar_saved", { name: activePeriod }));
    });
  }
}

// Escuchar cambios en localStorage desde otras pestañas/páginas
window.addEventListener("storage", (e) => {
  if (e.key === "atenas_students" || e.key === "atenas_config") {
    loadPersistedData();
    updateDatabaseStatusUI();
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

// Mostrar y Ocultar Spinner de Carga
function showLoader(text) {
  const loaderText = document.getElementById("loader-text");
  const loaderContainer = document.getElementById("loader-container");
  const viewCargar = document.getElementById("view-cargar");

  if (loaderText) loaderText.textContent = text;
  if (loaderContainer) loaderContainer.style.display = "flex";
  if (viewCargar) viewCargar.style.display = "none";
}

function hideLoader() {
  const loaderContainer = document.getElementById("loader-container");
  const viewCargar = document.getElementById("view-cargar");

  if (loaderContainer) loaderContainer.style.display = "none";
  if (viewCargar) viewCargar.style.display = "block";
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
      alert(t("err_file_format"));
    }
  }, 500);
}

// Procesar Selección de Archivos
function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
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
          alert(t("err_csv_process", { error: err.message }));
        }
      },
      error: function(err) {
        hideLoader();
        alert(t("err_csv_parse", { error: err.message }));
      }
    });
  };
  reader.onerror = function() {
    hideLoader();
    alert(t("err_csv_read"));
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
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const raw2DArray = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      
      const rows = detectHeadersAndParseRows(raw2DArray);
      handleParsedRows(rows);
    } catch (err) {
      hideLoader();
      alert(t("err_excel_process", { error: err.message }));
    }
  };
  reader.onerror = function() {
    hideLoader();
    alert(t("err_file_read"));
  };
  reader.readAsArrayBuffer(file);
}

// Manejar los datos crudos extraídos del archivo
function handleParsedRows(rawRows) {
  if (!rawRows || rawRows.length === 0) {
    hideLoader();
    alert(t("msg_file_empty"));
    return;
  }

  const targetPeriod = document.getElementById("import-period-select").value;

  // 1. Agrupar y calcular promedios para los alumnos del archivo subido
  const newStudents = groupAndCalculateStudentsForPeriod(rawRows, SYSTEM_CONFIG, targetPeriod);

  // 2. Filtrar los estudiantes existentes para eliminar los del periodo destino (sobreescritura selectiva)
  const otherStudents = state.students.filter(s => s.periodo !== targetPeriod);

  // 3. Unir y actualizar el estado
  state.students = [...otherStudents, ...newStudents];

  // 4. Guardar datos en localStorage
  persistData();

  hideLoader();
  updateDatabaseStatusUI();
  
  alert(t("msg_file_success", { count: newStudents.length, name: targetPeriod }));
}

// Agrupar filas duplicadas por estudiante (Carnet) e inyectar su historial para un periodo específico
function groupAndCalculateStudentsForPeriod(rawRows, config, targetPeriod) {
  const studentMap = new Map();
  const periodsConfig = getPeriodsConfig();
  const periodConfig = periodsConfig[targetPeriod] || DEFAULT_PERIODS_CONFIG["Ciclo 1 - 2026"];
  
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
        periodo: targetPeriod,
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
  
  studentsArray.forEach((student) => {
    student.id = targetPeriod + "_" + student.carnet; // ID único por ciclo
    calculateStudentMetrics(student, config, periodConfig);
  });
  
  return studentsArray;
}

// Actualizar la interfaz de la tarjeta de estado de la base de datos
function updateDatabaseStatusUI() {
  const container = document.getElementById("db-status-container");
  if (!container) return;

  const activePeriod = getActivePeriod();
  const activeStudents = state.students.filter(s => s.periodo === activePeriod);
  const totalActive = activeStudents.length;
  const totalHistorial = state.students.length;
  
  if (totalActive > 0) {
    const carrerasCount = new Set(activeStudents.map(s => s.carrera)).size;
    const materiasSet = new Set();
    activeStudents.forEach(s => s.subjects.forEach(sub => materiasSet.add(sub.materia)));
    const materiasCount = materiasSet.size;

    container.innerHTML = `
      <div class="status-card-success">
        <i data-lucide="database" style="flex-shrink: 0; width: 22px; height: 22px; margin-top: 2px;"></i>
        <div style="font-size: 0.8rem; line-height: 1.4; width: 100%;">
          <strong>${t("db_active_title", { period: activePeriod })}</strong>
          ${t("db_active_desc")}
          <ul style="margin-top: 6px; padding-left: 16px;">
            <li>${t("db_active_students")} <strong>${totalActive}</strong></li>
            <li>${t("db_active_subjects")} <strong>${materiasCount}</strong></li>
            <li>${t("db_active_careers")} <strong>${carrerasCount}</strong></li>
            <li>${t("db_active_history")} <strong>${totalHistorial}</strong></li>
          </ul>
        </div>
      </div>
    `;
  } else {
    const noteText = totalHistorial > 0 ? `<div style="margin-top: 8px; font-weight: 500;">${t("db_inactive_note", { count: totalHistorial })}</div>` : '';
    container.innerHTML = `
      <div class="status-card-danger">
        <i data-lucide="database-backup" style="flex-shrink: 0; width: 22px; height: 22px;"></i>
        <div style="font-size: 0.8rem; line-height: 1.4; width: 100%;">
          <strong>${t("db_inactive_title", { period: activePeriod })}</strong>
          ${t("db_inactive_desc")}
          ${noteText}
        </div>
      </div>
    `;
  }

  // Recargar iconos
  lucide.createIcons();
}

// Limpiar base de datos local
function clearDatabase() {
  if (state.students.length === 0) {
    alert(t("err_db_already_empty"));
    return;
  }

  showConfirmModal(t("confirm_title_clear_db"), t("confirm_clear_db"), "danger")
    .then(confirmed => {
      if (confirmed) {
        state.students = [];
        localStorage.removeItem("atenas_students");
        updateDatabaseStatusUI();
        alert(t("msg_db_cleared"));
      }
    });
}

// GENERADOR DE DATOS DE SIMULACIÓN REALISTAS (CARGA DEMO ACTUALIZADA)
function loadDemoData() {
  showLoader("Generando matriz de calificaciones estudiantiles simulada (100+ alumnos)...");

  setTimeout(() => {
    // 1. Configurar los 3 ciclos académicos de demostración
    const periodsConfig = getPeriodsConfig();

    periodsConfig["Ciclo 1 - 2026"] = {
      status: "completed", // Culminado, divisor 4
      cycleStart: "2026-02-01",
      cycleEnd: "2026-06-30",
      unit1End: "2026-03-05",
      unit2End: "2026-04-10",
      unit3End: "2026-05-15",
      unit4End: "2026-06-20",
      simulationDate: ""
    };

    periodsConfig["Ciclo 2 - 2026"] = {
      status: "active", // Activo, simulación en Unidad 2
      cycleStart: "2026-07-20",
      cycleEnd: "2026-12-15",
      unit1End: "2026-08-25",
      unit2End: "2026-09-30",
      unit3End: "2026-11-05",
      unit4End: "2026-12-10",
      simulationDate: "2026-09-15" // Unidad 2 activa
    };

    periodsConfig["Ciclo 1 - 2027"] = {
      status: "active", // Activo futuro
      cycleStart: "2027-02-01",
      cycleEnd: "2027-06-30",
      unit1End: "2027-03-05",
      unit2End: "2027-04-10",
      unit3End: "2027-05-15",
      unit4End: "2027-06-20",
      simulationDate: "" // Fecha actual (asume unidad 4 ya que hoy es 2026 pero el ciclo es en 2027)
    };

    savePeriodsConfig(periodsConfig);

    // 2. Definir pools de carreras, asignaturas, docentes y nombres
    const materiasPool = [
      { name: "Álgebra Vectorial", prof: "Dr. Jorge Valdivia" },
      { name: "Programación Orientada a Objetos", prof: "Ing. Carlos Benítez" },
      { name: "Estructura de Datos", prof: "Dra. Elena Rostova" },
      { name: "Física Mecánica", prof: "Lic. Sofía Alvarenga" },
      { name: "Macroeconomía Básica", prof: "Dra. Lucía Méndez" },
      { name: "Bases de Datos", prof: "Ing. Mario Castañeda" },
      { name: "Diseño de Interfaces", prof: "Lic. Clara Fuentes" },
      { name: "Sistemas Operativos", prof: "Dr. Ernesto Sábato" },
      { name: "Redes de Computadoras", prof: "Ing. Alicia Romero" },
      { name: "Cálculo Diferencial", prof: "Dr. Roberto Gómez" }
    ];

    const carrerasPool = [
      "ING01", // Ingeniería de Sistemas
      "ING02", // Ingeniería Industrial
      "LIC01", // Licenciatura en Informática
      "TEC01", // Técnico en Desarrollo de Software
      "DIS01"  // Licenciatura en Diseño Gráfico
    ];
    
    const nombres = [
      "Sofía", "Mateo", "Valentina", "Santiago", "Camila", "Sebastián", "Isabella", 
      "Alejandro", "Mariana", "Diego", "Gabriela", "Nicolás", "Daniela", "Samuel",
      "Martina", "Lucas", "Lucía", "Benjamín", "Valeria", "Emilio", "Andrea", "Felipe",
      "Adrián", "Clara", "Daniel", "Elena", "Fernando", "Isabel", "Javier", "Laura"
    ];
    const apellidos = [
      "González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", 
      "Pérez", "García", "Sánchez", "Romero", "Álvarez", "Torres", "Ruiz", "Ramírez",
      "Flores", "Acosta", "Benítez", "Medina", "Herrera", "Castro", "Vargas", "Rojas",
      "Guzmán", "Morales", "Ortega", "Silva", "Delgado", "Mendoza", "Ríos", "Peralta"
    ];

    const generateIdString = (idx) => {
      const year = "2024";
      const seq = String(idx).padStart(4, '0');
      return `${year}-${seq}`;
    };

    // Crear un pool de 110 estudiantes con datos demográficos
    const studentPool = [];
    for (let i = 1; i <= 110; i++) {
      const nom = nombres[Math.floor(Math.random() * nombres.length)];
      const ape = apellidos[Math.floor(Math.random() * apellidos.length)] + " " + apellidos[Math.floor(Math.random() * apellidos.length)];
      const carr = carrerasPool[Math.floor(Math.random() * carrerasPool.length)];
      
      let profileType = "safe";
      const rand = Math.random();
      if (rand < 0.22) {
        profileType = "failing"; // Alto riesgo
      } else if (rand < 0.52) {
        profileType = "warning"; // Medio riesgo
      }

      studentPool.push({
        carnet: generateIdString(i),
        nombres: nom,
        apellidos: ape,
        carrera: carr,
        profileType: profileType
      });
    }

    const demoRawRows = [];

    // Función para simular notas realistas
    const generateGrades = (profileType, isCompleted, isFuture) => {
      let l1, l2, l3, l4, p1, p2, p3, p4;
      
      if (profileType === "failing") {
        const isFailSubject = Math.random() < 0.65;
        if (isFailSubject) {
          l1 = Math.random() * 3.5 + 2.5; l2 = Math.random() * 3.0 + 3.0; l3 = Math.random() * 3.5 + 2.0; l4 = Math.random() * 4.0 + 1.8;
          p1 = Math.random() * 3.0 + 2.0; p2 = Math.random() * 3.5 + 2.0; p3 = Math.random() * 3.0 + 1.5; p4 = Math.random() * 2.5 + 2.0;
        } else {
          l1 = Math.random() * 2.0 + 5.5; l2 = Math.random() * 1.5 + 6.0; l3 = Math.random() * 2.0 + 5.5; l4 = Math.random() * 1.8 + 6.0;
          p1 = Math.random() * 2.0 + 5.0; p2 = Math.random() * 2.0 + 5.5; p3 = Math.random() * 2.5 + 4.5; p4 = Math.random() * 2.0 + 5.0;
        }
      } else if (profileType === "warning") {
        l1 = Math.random() * 2.0 + 6.0; l2 = Math.random() * 1.5 + 6.2; l3 = Math.random() * 2.0 + 5.5; l4 = Math.random() * 1.8 + 6.0;
        p1 = Math.random() * 2.0 + 5.0; p2 = Math.random() * 2.0 + 5.8; p3 = Math.random() * 2.5 + 4.5; p4 = Math.random() * 2.0 + 5.0;
      } else {
        l1 = Math.random() * 2.5 + 7.5; l2 = Math.random() * 2.0 + 8.0; l3 = Math.random() * 2.5 + 7.5; l4 = Math.random() * 3.0 + 7.0;
        p1 = Math.random() * 2.5 + 7.0; p2 = Math.random() * 2.0 + 8.0; p3 = Math.random() * 3.0 + 7.0; p4 = Math.random() * 2.5 + 7.5;
      }

      // Si es el ciclo de simulación activo (Ciclo 2 - 2026, cortado en Unidad 2), las unidades 3 y 4 deben estar en 0 en la importación
      if (!isCompleted && !isFuture) {
        l3 = 0; p3 = 0;
        l4 = 0; p4 = 0;
      }

      // Si es el ciclo futuro (Ciclo 1 - 2027), todo a 0 (o con muy pocas notas para simular inicio de ciclo)
      if (isFuture) {
        l1 = Math.random() < 0.3 ? Math.round((Math.random() * 6 + 4) * 10) / 10 : 0;
        p1 = 0; l2 = 0; p2 = 0; l3 = 0; p3 = 0; l4 = 0; p4 = 0;
      }

      return {
        lab1: Math.round(l1 * 10) / 10,
        par1: Math.round(p1 * 10) / 10,
        lab2: Math.round(l2 * 10) / 10,
        par2: Math.round(p2 * 10) / 10,
        lab3: Math.round(l3 * 10) / 10,
        par3: Math.round(p3 * 10) / 10,
        lab4: Math.round(l4 * 10) / 10,
        par4: Math.round(p4 * 10) / 10
      };
    };

    // Enrollar estudiantes en múltiples ciclos
    // Ciclo 1 - 2026 (Culminado) -> Alumnos 1 al 75
    studentPool.slice(0, 75).forEach(std => {
      const numSubjects = Math.floor(Math.random() * 2) + 3;
      const shuffledMaterias = [...materiasPool].sort(() => 0.5 - Math.random());
      const selected = shuffledMaterias.slice(0, numSubjects);

      selected.forEach(matInfo => {
        const grades = generateGrades(std.profileType, true, false);
        demoRawRows.push({
          periodo: "Ciclo 1 - 2026",
          Docente: matInfo.prof,
          Materia: matInfo.name,
          Grupo: "01",
          Carnet: std.carnet,
          Apellidos: std.apellidos,
          Nombres: std.nombres,
          "Código Carrera": std.carrera,
          "Lab #1": grades.lab1, "Par #1": grades.par1,
          "Lab #2": grades.lab2, "Par #2": grades.par2,
          "Lab #3": grades.lab3, "Par #3": grades.par3,
          "Lab #4": grades.lab4, "Par #4": grades.par4
        });
      });
    });

    // Ciclo 2 - 2026 (Activo, corte Unidad 2) -> Alumnos 25 al 110 (50 overlapping con ciclo anterior)
    studentPool.slice(24, 110).forEach(std => {
      const numSubjects = Math.floor(Math.random() * 2) + 3;
      const shuffledMaterias = [...materiasPool].sort(() => 0.5 - Math.random());
      const selected = shuffledMaterias.slice(0, numSubjects);

      selected.forEach(matInfo => {
        const grades = generateGrades(std.profileType, false, false);
        demoRawRows.push({
          periodo: "Ciclo 2 - 2026",
          Docente: matInfo.prof,
          Materia: matInfo.name,
          Grupo: "02",
          Carnet: std.carnet,
          Apellidos: std.apellidos,
          Nombres: std.nombres,
          "Código Carrera": std.carrera,
          "Lab #1": grades.lab1, "Par #1": grades.par1,
          "Lab #2": grades.lab2, "Par #2": grades.par2,
          "Lab #3": grades.lab3, "Par #3": grades.par3,
          "Lab #4": grades.lab4, "Par #4": grades.par4
        });
      });
    });

    // Ciclo 1 - 2027 (Futuro, sin notas prácticamente) -> Alumnos 50 al 105
    studentPool.slice(49, 105).forEach(std => {
      const numSubjects = Math.floor(Math.random() * 2) + 3;
      const shuffledMaterias = [...materiasPool].sort(() => 0.5 - Math.random());
      const selected = shuffledMaterias.slice(0, numSubjects);

      selected.forEach(matInfo => {
        const grades = generateGrades(std.profileType, false, true);
        demoRawRows.push({
          periodo: "Ciclo 1 - 2027",
          Docente: matInfo.prof,
          Materia: matInfo.name,
          Grupo: "01",
          Carnet: std.carnet,
          Apellidos: std.apellidos,
          Nombres: std.nombres,
          "Código Carrera": std.carrera,
          "Lab #1": grades.lab1, "Par #1": grades.par1,
          "Lab #2": grades.lab2, "Par #2": grades.par2,
          "Lab #3": grades.lab3, "Par #3": grades.par3,
          "Lab #4": grades.lab4, "Par #4": grades.par4
        });
      });
    });

    // 3. Procesar y guardar por lotes para cada uno de los periodos generados
    let allDemoStudents = [];
    
    ["Ciclo 1 - 2026", "Ciclo 2 - 2026", "Ciclo 1 - 2027"].forEach(pName => {
      const periodRows = demoRawRows.filter(r => r.periodo === pName);
      const periodStudents = groupAndCalculateStudentsForPeriod(periodRows, SYSTEM_CONFIG, pName);
      allDemoStudents = [...allDemoStudents, ...periodStudents];
    });

    state.students = allDemoStudents;
    persistData();

    // Actualizar selectores
    initGlobalPeriodSelector((newPeriod) => {
      loadCalendarSettingsToForm(newPeriod);
      updateDatabaseStatusUI();
    });
    updateImportPeriodSelect();

    hideLoader();
    updateDatabaseStatusUI();
    
    alert(t("msg_demo_loaded"));
  }, 600);
}

// DESCARGAR PLANTILLA CSV DE MUESTRA
function downloadTemplateCSV() {
  const headers = REQUIRED_COLUMNS.join(";");
  const rows = [
    "Ing. Carlos Benítez;Programación Orientada a Objetos;01;2024-0001;González Pérez;Mateo;ING01;7.5;8.0;6.8;7.2;8.0;7.5;9.0;8.5;7.825;7.800;7.81",
    "Dra. Elena Rostova;Estructura de Datos;02;2024-0002;Rodríguez Gómez;Sofía;ING01;5.5;6.0;6.2;5.5;5.0;6.2;5.8;4.8;5.625;5.625;5.63",
    "Dr. Jorge Valdivia;Álgebra Vectorial;01;2024-0003;Gómez Fernández;Lucas;ING02;6.8;6.2;6.5;6.8;6.0;6.1;7.0;6.5;6.575;6.400;6.47"
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

window.addEventListener("languagechange", () => {
  updateDatabaseStatusUI();
});



