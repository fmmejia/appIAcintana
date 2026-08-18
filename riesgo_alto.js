/* ==========================================================================
   LISTADO DE ESTUDIANTES EN RIESGO ALTO - LOGICA DE NEGOCIO (riesgo_alto.js)
   ========================================================================== */

// Configuración Global y Variables de Estado
const state = {
  allStudents: [],       // Todos los estudiantes leídos de localStorage
  students: [],          // Estudiantes que están en Riesgo Alto
  filteredStudents: [],  // Estudiantes filtrados por los controles de búsqueda
  currentPage: 1,
  pageSize: 10,
  filters: {
    search: "",
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
  if (e.key === "atenas_students" || e.key === "atenas_config" || e.key === "atenas_system_config") {
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
  state.config = getSystemConfig();

  // Ocultar loader al cargar
  const loader = document.getElementById("loader-container");
  if (loader) loader.style.display = "none";

  if (savedStudents) {
    const allStudents = JSON.parse(savedStudents);
    const activePeriod = getActivePeriod();
    const periodsConfig = getPeriodsConfig();
    const periodConfig = periodsConfig[activePeriod] || DEFAULT_PERIODS_CONFIG["Ciclo 1 - 2026"];

    // Filtrar por el periodo activo y recalcular métricas correspondientes
    state.allStudents = allStudents.filter(s => s.periodo === activePeriod);
    state.allStudents.forEach(student => {
      calculateStudentMetrics(student, state.config, periodConfig);
    });

    // Filtrar únicamente los estudiantes en riesgo alto (Reprobados o CUM < 6.0)
    state.students = state.allStudents.filter(student => student.riskLevel === "high");

    // Resetear filtros
    state.filters = {
      search: "",
      carrera: "all",
      materia: "all",
      docente: "all"
    };
    state.sortColumn = "student";
    state.sortDirection = "asc";

    // Cargar filtros dinámicos basados en la población de riesgo alto
    populateFilterDropdowns();
    
    // Renderizar listado de estudiantes
    filterAndRenderStudents();
  } else {
    // Si no hay datos, mostrar tabla vacía
    state.allStudents = [];
    state.students = [];
    state.filteredStudents = [];
    
    const countEl = document.getElementById("students-found-count");
    if (countEl) countEl.textContent = "0 estudiantes encontrados";
    
    renderStudentsTable();
  }
}

// Registrar los Event Listeners de la Interfaz
function setupEventListeners() {
  // Controles de Filtrado
  const searchInput = document.getElementById("search-students");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.filters.search = searchInput.value.trim().toLowerCase();
      filterAndRenderStudents();
    });
  }
  
  const materiaSelect = document.getElementById("filter-materia");
  if (materiaSelect) {
    materiaSelect.addEventListener("change", () => {
      state.filters.materia = materiaSelect.value;
      filterAndRenderStudents();
    });
  }
  
  const docenteSelect = document.getElementById("filter-docente");
  if (docenteSelect) {
    docenteSelect.addEventListener("change", () => {
      state.filters.docente = docenteSelect.value;
      filterAndRenderStudents();
    });
  }
  
  const carreraSelect = document.getElementById("filter-carrera");
  if (carreraSelect) {
    carreraSelect.addEventListener("change", () => {
      state.filters.carrera = carreraSelect.value;
      filterAndRenderStudents();
    });
  }

  // Botón Limpiar Filtros
  const btnClearFilters = document.getElementById("btn-clear-filters");
  if (btnClearFilters) {
    btnClearFilters.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (materiaSelect) materiaSelect.value = "all";
      if (docenteSelect) docenteSelect.value = "all";
      if (carreraSelect) carreraSelect.value = "all";
      
      state.filters = {
        search: "",
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

  // Cerrar Modal al presionar el botón 'x'
  const btnCloseModal = document.getElementById("btn-close-modal");
  if (btnCloseModal) btnCloseModal.addEventListener("click", closeModal);

  // Cerrar Modal al hacer clic en el fondo gris traslúcido (overlay)
  const studentModal = document.getElementById("student-modal");
  if (studentModal) {
    studentModal.addEventListener("click", (e) => {
      if (e.target === studentModal) {
        closeModal();
      }
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
  
  // Regla general de riesgo
  if (failingCount > 0 || student.calculatedFinal < config.thresholdFail) {
    student.riskLevel = "high";
  } else if (student.calculatedFinal < config.thresholdCum) {
    student.riskLevel = "medium";
  } else {
    student.riskLevel = "low";
  }
}

// Cargar Dropdowns de Filtros Dinámicamente con valores disponibles en el listado de Riesgo Alto (Excel-like dependent dropdowns)
function populateFilterDropdowns() {
  const carreraSelect = document.getElementById("filter-carrera");
  const materiaSelect = document.getElementById("filter-materia");
  const docenteSelect = document.getElementById("filter-docente");

  if (!carreraSelect || !materiaSelect || !docenteSelect) return;

  const searchQuery = state.filters.search;
  const carreraFilter = state.filters.carrera;
  const materiaFilter = state.filters.materia;
  const docenteFilter = state.filters.docente;

  // 1. Filtrar para Carreras (ignora carreraFilter)
  const studentsForCarrera = state.students.filter(student => {
    const matchesSearch = searchQuery === "" || 
      student.nombres.toLowerCase().includes(searchQuery) ||
      student.apellidos.toLowerCase().includes(searchQuery) ||
      student.carnet.toLowerCase().includes(searchQuery);
    
    // El estudiante debe cursar al menos una materia que coincida con la materia y docente seleccionados
    const matchesSubject = student.subjects.some(subj => {
      const mMat = materiaFilter === "all" || normalizeStr(subj.materia) === normalizeStr(materiaFilter);
      const mDoc = docenteFilter === "all" || normalizeStr(subj.docente) === normalizeStr(docenteFilter);
      return mMat && mDoc;
    });
    
    return matchesSearch && matchesSubject;
  });
  const availableCarreras = [...new Set(studentsForCarrera.map(s => s.carrera))].sort();

  // 2. Filtrar para Materias (ignora materiaFilter)
  const studentsForMateria = state.students.filter(student => {
    const matchesSearch = searchQuery === "" || 
      student.nombres.toLowerCase().includes(searchQuery) ||
      student.apellidos.toLowerCase().includes(searchQuery) ||
      student.carnet.toLowerCase().includes(searchQuery);
    const matchesCarrera = carreraFilter === "all" || student.carrera === carreraFilter;
    
    const matchesSubject = student.subjects.some(subj => docenteFilter === "all" || normalizeStr(subj.docente) === normalizeStr(docenteFilter));
    
    return matchesSearch && matchesCarrera && matchesSubject;
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
    const matchesCarrera = carreraFilter === "all" || student.carrera === carreraFilter;
    
    const matchesSubject = student.subjects.some(subj => materiaFilter === "all" || normalizeStr(subj.materia) === normalizeStr(materiaFilter));
    
    return matchesSearch && matchesCarrera && matchesSubject;
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
  carreraSelect.innerHTML = `<option value="all">${t("filter_opt_all_careers")}</option>`;
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
  materiaSelect.innerHTML = `<option value="all">${t("filter_opt_all_subjects")}</option>`;
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
  docenteSelect.innerHTML = `<option value="all">${t("filter_opt_all_teachers")}</option>`;
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

// Filtrar Estudiantes basados en Búsqueda y Dropdowns
function filterAndRenderStudents() {
  // 1. Rellenar dropdowns con opciones dependientes
  populateFilterDropdowns();

  const searchQuery = state.filters.search;
  const carreraFilter = state.filters.carrera;
  const materiaFilter = state.filters.materia;
  const docenteFilter = state.filters.docente;

  // Filtrar el listado que ya contiene exclusivamente estudiantes de Riesgo Alto
  state.filteredStudents = state.students.filter(student => {
    const matchesSearch = searchQuery === "" || 
      student.nombres.toLowerCase().includes(searchQuery) ||
      student.apellidos.toLowerCase().includes(searchQuery) ||
      student.carnet.toLowerCase().includes(searchQuery);

    const matchesCarrera = carreraFilter === "all" || student.carrera === carreraFilter;
    
    // Se filtra por la combinación exacta del par Materia-Docente en la misma fila del alumno
    const matchesSubject = student.subjects.some(subj => {
      const mMat = materiaFilter === "all" || normalizeStr(subj.materia) === normalizeStr(materiaFilter);
      const mDoc = docenteFilter === "all" || normalizeStr(subj.docente) === normalizeStr(docenteFilter);
      return mMat && mDoc;
    });

    return matchesSearch && matchesCarrera && matchesSubject;
  });

  // Ordenar
  sortFilteredStudents();

  // Mostrar u ocultar botón de limpiar filtros
  const isFilterActive = searchQuery !== "" || carreraFilter !== "all" || materiaFilter !== "all" || docenteFilter !== "all";
  const btnClearFilters = document.getElementById("btn-clear-filters");
  if (btnClearFilters) {
    btnClearFilters.style.display = isFilterActive ? "flex" : "none";
  }

  // Actualizar contador
  const labelEl = document.getElementById("students-found-count");
  if (labelEl) {
    const count = state.filteredStudents.length;
    if (count === 1) {
      labelEl.textContent = t("filter_count_singular");
    } else {
      labelEl.textContent = t("filter_count_plural", { count: count });
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
  const carreraFilter = state.filters.carrera;
  const materiaFilter = state.filters.materia;
  const docenteFilter = state.filters.docente;

  const carreraSelect = document.getElementById("filter-carrera");
  const searchInput = document.getElementById("search-students");
  const materiaSelect = document.getElementById("filter-materia");
  const docenteSelect = document.getElementById("filter-docente");

  const activeFilters = [];

  if (searchQuery !== "") {
    activeFilters.push({
      label: t("badge_filter_search", { val: searchQuery }),
      clear: () => {
        state.filters.search = "";
        if (searchInput) searchInput.value = "";
      }
    });
  }

  if (carreraFilter !== "all" && carreraSelect) {
    const option = carreraSelect.querySelector(`option[value="${carreraFilter}"]`);
    const text = option ? option.text : (CAREER_NAMES[carreraFilter] || carreraFilter);
    activeFilters.push({
      label: t("badge_filter_career", { val: text }),
      clear: () => {
        state.filters.carrera = "all";
        carreraSelect.value = "all";
      }
    });
  }

  if (materiaFilter !== "all") {
    activeFilters.push({
      label: t("badge_filter_subject", { val: materiaFilter }),
      clear: () => {
        state.filters.materia = "all";
        if (materiaSelect) materiaSelect.value = "all";
      }
    });
  }

  if (docenteFilter !== "all") {
    activeFilters.push({
      label: t("badge_filter_teacher", { val: docenteFilter }),
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
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);"><i data-lucide="info" style="vertical-align: middle; margin-right: 8px;"></i> ${t("msg_no_students_found")}</td></tr>`;
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
      <td style="text-align: center; font-family: monospace; font-weight: 700;">
        ${student.calculatedFinal.toFixed(2)}
      </td>
      <td>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </td>
      <td style="text-align: center;">
        <button class="btn-action-view" onclick="openStudentModal('${student.id}')">
          <i data-lucide="user-cog"></i> Ficha
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Actualizar indicador de paginación
  document.getElementById("pagination-text").textContent = t("records_showing", { start: startIdx + 1, end: endIdx, total: totalFiltered });

  // Renderizar botones de paginación
  renderPaginationButtons(totalFiltered);
  
  // Refrescar iconos Lucide inyectados
  lucide.createIcons();
}

// Renderizar Botones del Panel de Paginación
function renderPaginationButtons(totalFiltered) {
  const container = document.getElementById("pagination-btns");
  if (!container) return;
  container.innerHTML = "";

  const totalPages = Math.ceil(totalFiltered / state.pageSize);
  if (totalPages <= 1) return; // No requiere paginar si es una sola página

  // Botón Anterior
  const btnPrev = document.createElement("button");
  btnPrev.className = "btn-page";
  btnPrev.innerHTML = `<i data-lucide="chevron-left"></i>`;
  btnPrev.disabled = state.currentPage === 1;
  btnPrev.onclick = () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderStudentsTable();
    }
  };
  container.appendChild(btnPrev);

  // Páginas Numéricas
  const maxVisiblePages = 5;
  let startPage = Math.max(1, state.currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    const btnPage = document.createElement("button");
    btnPage.className = `btn-page ${i === state.currentPage ? 'active' : ''}`;
    btnPage.textContent = i;
    btnPage.onclick = () => {
      state.currentPage = i;
      renderStudentsTable();
    };
    container.appendChild(btnPage);
  }

  // Botón Siguiente
  const btnNext = document.createElement("button");
  btnNext.className = "btn-page";
  btnNext.innerHTML = `<i data-lucide="chevron-right"></i>`;
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
    cumProgress.style.backgroundColor = "var(--color-risk-high)";
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

  if (diagCard) diagCard.className = `alert-indicator-card ${diagClass}`;
  if (diagIcon) diagIcon.setAttribute("data-lucide", student.riskLevel === "high" ? "alert-triangle" : (student.riskLevel === "medium" ? "alert-circle" : "check-circle"));
  if (diagTitle) diagTitle.textContent = titleText;
  if (diagDesc) diagDesc.textContent = descText;

  generateRecommendations(student);

  document.getElementById("student-modal").classList.add("active");
  lucide.createIcons();
}

// Cargar Detalle de Asignatura Seleccionada en el Modal
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

// Limpiar Detalles en el Modal
function clearSubjectDetails() {
  document.getElementById("modal-detail-materia-name").textContent = "Seleccione...";
  document.getElementById("modal-detail-materia-grade").textContent = "0.00";
  document.getElementById("modal-detail-materia-teacher").textContent = "-";
  document.getElementById("modal-detail-materia-group").textContent = "-";
  document.getElementById("modal-detail-materia-labs-avg").textContent = "0.00";
  document.getElementById("modal-detail-materia-pars-avg").textContent = "0.00";

  const clearGradeCard = (elId) => {
    const card = document.getElementById(elId);
    const textVal = document.getElementById("modal-val-" + elId.replace("modal-card-", ""));
    if (card) card.className = "grade-sub-card";
    if (textVal) textVal.textContent = "0.0";
  };

  clearGradeCard("modal-card-lab-1");
  clearGradeCard("modal-card-lab-2");
  clearGradeCard("modal-card-lab-3");
  clearGradeCard("modal-card-lab-4");
  clearGradeCard("modal-card-par-1");
  clearGradeCard("modal-card-par-2");
  clearGradeCard("modal-card-par-3");
  clearGradeCard("modal-card-par-4");
}

// Cerrar Modal
function closeModal() {
  const modal = document.getElementById("student-modal");
  if (modal) modal.classList.remove("active");
}

// Generar Recomendaciones de Acompañamiento
function generateRecommendations(student) {
  const container = document.getElementById("modal-recommendations-container");
  if (!container) return;
  container.innerHTML = "";

  const recs = [];

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

// Manejar cambio de Tema (Light/Dark)
function setupThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isLight = document.body.classList.toggle("light-theme");
      document.documentElement.classList.toggle("light-theme");
      localStorage.setItem("atenas_theme", isLight ? "light" : "dark");
      updateThemeIcon();
    });
  }
  updateThemeIcon();
}

function updateThemeIcon() {
  const themeToggleIcon = document.getElementById("theme-toggle-icon");
  if (!themeToggleIcon) return;
  const isLight = document.body.classList.contains("light-theme");
  themeToggleIcon.setAttribute("data-lucide", isLight ? "moon" : "sun");
  lucide.createIcons();
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

