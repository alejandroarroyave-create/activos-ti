const supabase = window.supabaseClient;
let equipos = [];
let colaboradores = [];
let movimientos = [];
let asignaciones = [];

// --- NUEVO: Cargar datos reales de la Nube ---
async function loadDataFromSupabase() {
    try {
        const [resEq, resCol, resAsig, resMov] = await Promise.all([
            supabase.from('equipos').select('*').order('created_at', { ascending: false }),
            supabase.from('colaboradores').select('*').order('created_at', { ascending: false }),
            supabase.from('asignaciones').select('*').order('fecha_asignacion', { ascending: false }),
            supabase.from('movimientos').select('*').order('created_at', { ascending: false })
        ]);

        if (resEq.data) equipos = resEq.data;
        if (resCol.data) colaboradores = resCol.data;
        if (resAsig.data) asignaciones = resAsig.data;
        if (resMov.data) movimientos = resMov.data;

        renderAll();
    } catch (err) {
        console.error("Error cargando base de datos:", err);
        alert("Hubo un problema sincronizando la base de datos.");
    }
}

const menuItems = document.querySelectorAll(".menu-item");
const views = document.querySelectorAll(".view");
const viewTitle = document.getElementById("viewTitle");
const viewSubtitle = document.getElementById("viewSubtitle");

const subtitles = {
    dashboard: "Control de equipos, colaboradores y asignaciones",
    equipos: "Creación y consulta de equipos",
    asignaciones: "Asignar equipos disponibles a colaboradores",
    colaboradores: "Gestión y búsqueda de colaboradores"
};

menuItems.forEach(btn => {
    btn.addEventListener("click", () => {
        menuItems.forEach(x => x.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.dataset.view;
        views.forEach(v => v.classList.remove("active"));
        document.getElementById(`${target}View`).classList.add("active");

        viewTitle.textContent = btn.textContent;
        viewSubtitle.textContent = subtitles[target];
    });
});

const origen = document.getElementById("origen");
const numeroRentado = document.getElementById("numeroRentado");
const nombreBase = document.getElementById("nombreBase");
const codigoGenerado = document.getElementById("codigoGenerado");
const rentadoFields = document.getElementById("rentadoFields");
const corporativoFields = document.getElementById("corporativoFields");

function normalizarCodigo(texto) {
    return texto.trim().toUpperCase().replace(/\s+/g, "-");
}

function actualizarCodigo() {
    if (origen.value === "Rentado") {
        rentadoFields.classList.remove("hidden");
        corporativoFields.classList.add("hidden");
        const numero = numeroRentado.value ? numeroRentado.value.trim() : "";
        codigoGenerado.value = numero ? `LAPTOP-DA-RE-${numero}` : "LAPTOP-DA-RE-";
    } else if (origen.value === "Corporativo") {
        corporativoFields.classList.remove("hidden");
        rentadoFields.classList.add("hidden");
        codigoGenerado.value = normalizarCodigo(nombreBase.value || "");
    } else {
        rentadoFields.classList.add("hidden");
        corporativoFields.classList.add("hidden");
        codigoGenerado.value = "";
    }
}

origen.addEventListener("change", actualizarCodigo);
numeroRentado.addEventListener("input", actualizarCodigo);
nombreBase.addEventListener("input", actualizarCodigo);

const equipoForm = document.getElementById("equipoForm");
equipoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const codigo = codigoGenerado.value.trim();
    const marca = document.getElementById("marca").value.trim();
    const modelo = document.getElementById("modelo").value.trim();
    const serial = document.getElementById("serial").value.trim();
    const estado = document.getElementById("estado").value;
    const observaciones = document.getElementById("observaciones").value.trim();

    if (!codigo) {
        alert("Debes generar un código válido.");
        return;
    }

    const existe = equipos.some(eq => eq.codigo === codigo);
    if (existe) {
        alert("Ese código de equipo ya existe en el inventario global.");
        return;
    }

    // Guardar en Supabase
    const { error: insertError } = await supabase.from('equipos').insert([{
        codigo, origen: origen.value, marca, modelo, serial, estado, observaciones, asignado_a: null
    }]);

    if (insertError) {
        alert("Error guardando el equipo en la base de datos.");
        console.error(insertError);
        return;
    }

    // Registrar el Movimiento
    await supabase.from('movimientos').insert([{
        accion: "CREACION", equipo: codigo
    }]);

    equipoForm.reset();
    codigoGenerado.value = "";
    actualizarCodigo();
    const equipoModal = document.getElementById("equipoModal");
    if (equipoModal) equipoModal.classList.add("hidden");
    
    await loadDataFromSupabase(); // Refrescar todo
    } catch (globalFormError) {
        alert("CRASH EN EL FORMULARIO: " + globalFormError.message);
        console.error(globalFormError);
    }
});

const asignacionForm = document.getElementById("asignacionForm");
asignacionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const colaborador = document.getElementById("colaborador").value.trim();
    const equipoCodigo = document.getElementById("equipoAsignar").value;
    const checks = [...document.querySelectorAll('.checks input[type="checkbox"]:checked')];
    const perifericos = checks.map(c => c.value).join(", ");

    if (!colaborador || !equipoCodigo) {
        alert("Debes seleccionar colaborador y equipo.");
        return;
    }

    // 1. Guardar la Asignacion
    const { error: asigError } = await supabase.from('asignaciones').insert([{
        colaborador, equipo: equipoCodigo, perifericos
    }]);

    if (asigError) {
        alert("Error creando la asignación.");
        console.error(asigError);
        return;
    }

    // 2. Actualizar el estado del equipo
    const { error: eqError } = await supabase.from('equipos')
        .update({ estado: "Asignado", asignado_a: colaborador })
        .eq('codigo', equipoCodigo);
        
    if (eqError) console.error("Error actualizando estado del equipo:", eqError);

    // 3. Registrar Movimiento
    await supabase.from('movimientos').insert([{
        accion: "ASIGNACION", equipo: equipoCodigo
    }]);

    asignacionForm.reset();
    const asignacionModal = document.getElementById("asignacionModal");
    if (asignacionModal) asignacionModal.classList.add("hidden");
    
    await loadDataFromSupabase(); // Refrescar todo
});


const colaboradorForm = document.getElementById("colaboradorForm");
if (colaboradorForm) {
    colaboradorForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("colNome").value.trim();
        const correo = document.getElementById("colCorreo").value.trim();
        const area = document.getElementById("colArea").value.trim();
        const cargo = document.getElementById("colCargo").value.trim();
        const estado = document.getElementById("colEstado").value;
        const observaciones = document.getElementById("colObservaciones").value.trim();

        const existe = colaboradores.some(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        if (existe) {
            alert("Ya existe un colaborador con este nombre.");
            return;
        }

        const { error } = await supabase.from('colaboradores').insert([{
            nombre, correo, area, cargo, estado, observaciones
        }]);

        if (error) {
            alert("Error guardando al colaborador.");
            console.error(error);
            return;
        }

        colaboradorForm.reset();
        const colaboradorModal = document.getElementById("colaboradorModal");
        if (colaboradorModal) {
            colaboradorModal.classList.add("hidden");
        }
        await loadDataFromSupabase();
    });
}


function renderEquiposTable() {
    const tbody = document.getElementById("equiposTable");
    const input = document.getElementById("busquedaEquipoInput");
    if (!tbody) return;

    let docs = equipos;
    if (input) {
        const term = input.value.toLowerCase().trim();
        if (term) {
            docs = equipos.filter(eq => 
                eq.codigo.toLowerCase().includes(term) || eq.marca.toLowerCase().includes(term)
            );
        }
    }

    tbody.innerHTML = docs.map(eq => `
    <tr>
      <td>${eq.codigo}</td>
      <td>${eq.origen}</td>
      <td>${eq.marca}</td>
      <td>${eq.modelo}</td>
      <td>${eq.estado}</td>
      <td>${eq.asignado_a || "-"}</td>
    </tr>
  `).join("");
}

const busquedaEquipoInput = document.getElementById("busquedaEquipoInput");
if (busquedaEquipoInput) busquedaEquipoInput.addEventListener("input", renderEquiposTable);

function renderEquiposRecent() {
    const tbody = document.getElementById("equiposRecentTable");
    tbody.innerHTML = equipos.slice(0, 5).map(eq => `
    <tr>
      <td>${eq.codigo}</td>
      <td>${eq.marca}</td>
      <td>${eq.modelo}</td>
      <td>${eq.estado}</td>
      <td>${eq.asignado_a || "-"}</td>
    </tr>
  `).join("");
}

function renderMovimientos() {
    const tbody = document.getElementById("movimientosTable");
    tbody.innerHTML = movimientos.slice(0, 5).map(m => `
    <tr>
      <td>${m.fecha || m.created_at.split('T')[0]}</td>
      <td>${m.accion}</td>
      <td>${m.equipo}</td>
    </tr>
  `).join("");
}

function renderAsignaciones() {
    const tbody = document.getElementById("asignacionesTable");
    const input = document.getElementById("busquedaAsignacionInput");
    if (!tbody) return;

    let docs = asignaciones;
    if (input) {
        const term = input.value.toLowerCase().trim();
        if (term) {
            docs = asignaciones.filter(a => 
                a.colaborador.toLowerCase().includes(term) || a.equipo.toLowerCase().includes(term)
            );
        }
    }

    tbody.innerHTML = docs.map(a => `
    <tr>
      <td>${a.colaborador}</td>
      <td>${a.equipo}</td>
      <td>${a.perifericos || "-"}</td>
    </tr>
  `).join("");
}

const busquedaAsignacionInput = document.getElementById("busquedaAsignacionInput");
if (busquedaAsignacionInput) busquedaAsignacionInput.addEventListener("input", renderAsignaciones);

function renderEquipoSelect() {
    const select = document.getElementById("equipoAsignar");
    const disponibles = equipos.filter(eq => eq.estado === "Disponible");

    select.innerHTML = `<option value="">Selecciona un equipo</option>` +
        disponibles.map(eq => `
      <option value="${eq.codigo}">
        ${eq.codigo} | ${eq.marca} | ${eq.modelo}
      </option>
    `).join("");
}

function renderStats() {
    document.getElementById("totalEquipos").textContent = equipos.length;
    document.getElementById("totalDisponibles").textContent =
        equipos.filter(eq => eq.estado === "Disponible").length;
    document.getElementById("totalAsignados").textContent =
        equipos.filter(eq => eq.estado === "Asignado").length;
    document.getElementById("totalRentados").textContent =
        equipos.filter(eq => eq.origen === "Rentado").length;
}

function renderColaboradoresDatalist() {
    const datalist = document.getElementById("datalistColaboradores");
    if (datalist) datalist.innerHTML = colaboradores.map(c => `<option value="${c.nombre}"></option>`).join("");
}

function renderEquiposDatalists() {
    const listMarcas = document.getElementById("datalistMarcas");
    const listModelos = document.getElementById("datalistModelos");

    if (listMarcas) {
        const marcasUnicas = [...new Set(equipos.map(eq => eq.marca).filter(Boolean))];
        listMarcas.innerHTML = marcasUnicas.map(m => `<option value="${m}"></option>`).join("");
    }

    if (listModelos) {
        const modelosUnicos = [...new Set(equipos.map(eq => eq.modelo).filter(Boolean))];
        listModelos.innerHTML = modelosUnicos.map(m => `<option value="${m}"></option>`).join("");
    }
}

function renderAll() {
    renderStats();
    renderEquiposTable();
    renderEquiposRecent();
    renderMovimientos();
    renderAsignaciones();
    renderEquipoSelect();
    renderColaboradores();
    renderColaboradoresDatalist();
    renderEquiposDatalists();
}

function renderColaboradores() {
    const tbody = document.getElementById("colaboradoresTableBody");
    const input = document.getElementById("busquedaColaboradorInput");
    if (!tbody || !input) return;

    const term = input.value.toLowerCase().trim();
    let docs = colaboradores;
    if (term) docs = colaboradores.filter(col => col.nombre.toLowerCase().includes(term));
    
    tbody.innerHTML = docs.map(col => `
    <tr class="clickable-row" style="cursor: pointer;" onclick="mostrarDetalleColaborador('${col.nombre.replace(/'/g, "\\'")}')">
      <td>${col.nombre}</td>
      <td>${col.correo}</td>
      <td>${col.area} / ${col.cargo}</td>
      <td>${col.estado}</td>
    </tr>
  `).join("");
}

const busquedaInput = document.getElementById("busquedaColaboradorInput");
if (busquedaInput) busquedaInput.addEventListener("input", renderColaboradores);

function mostrarDetalleColaborador(nombre) {
    const col = colaboradores.find(c => c.nombre === nombre);
    if (!col) return;

    document.getElementById("detalleColaboradorNombre").textContent = col.nombre;
    document.getElementById("detalleColaboradorCorreo").textContent = col.correo;
    document.getElementById("detalleColaboradorAreaCargo").textContent = col.area + " / " + col.cargo;
    document.getElementById("detalleColaboradorEstado").textContent = col.estado;
    document.getElementById("detalleColaboradorObs").textContent = col.observaciones || "Ninguna";

    const listas = asignaciones.filter(a => a.colaborador === nombre);
    const container = document.getElementById("detalleColaboradorEquipos");

    if (listas.length === 0) {
        container.innerHTML = "<p style='color: #6b7280; font-size: 14px;'>No tiene equipos asignados actualmente.</p>";
    } else {
        container.innerHTML = listas.map(asig => {
            const eq = equipos.find(e => e.codigo === asig.equipo);
            const equipoData = eq 
                ? `<strong>Marca:</strong> ${eq.marca} | <strong>Modelo:</strong> ${eq.modelo} | <strong>Serial:</strong> ${eq.serial}` 
                : `<span style="color:#ef4444">Equipo no encontrado</span>`;
            
            return `
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <p style="margin: 0 0 5px;"><strong>Equipo:</strong> ${asig.equipo}</p>
                <p style="margin: 0 0 5px; font-size: 13px; color: #4b5563;">${equipoData}</p>
                <p style="margin: 0; font-size: 13px; color: #4b5563;"><strong>Periféricos:</strong> ${asig.perifericos || "Ninguno"}</p>
            </div>
            `;
        }).join("");
    }

    document.getElementById("detalleColaboradorModal").classList.remove("hidden");
}

const modals = [
    { modalId: "equipoModal", openId: "btnOpenEquipoModal", closeId: "btnCloseEquipoModal" },
    { modalId: "asignacionModal", openId: "btnOpenAsignacionModal", closeId: "btnCloseAsignacionModal" },
    { modalId: "colaboradorModal", openId: "btnOpenColaboradorModal", closeId: "btnCloseColaboradorModal" },
    { modalId: "detalleColaboradorModal", openId: null, closeId: "btnCloseDetalleColaboradorModal" }
];

modals.forEach(({ modalId, openId, closeId }) => {
    const modal = document.getElementById(modalId);
    const openBtn = document.getElementById(openId);
    const closeBtn = document.getElementById(closeId);
    
    if (modal && openBtn) openBtn.addEventListener("click", () => modal.classList.remove("hidden"));
    if (modal && closeBtn) closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
    if (modal) modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
});

// Iniciador de la App
const __originalRender = renderAll;
renderAll = function() {
   // Intercetamos el llamado original del final del script 
   // Porque ahora requerimos esperar a base de datos.
};

// Cargar la data al iniciar si hay sesion
document.addEventListener('DOMContentLoaded', async () => {
    // Restauramos funcionalidad
    if (typeof __originalRender !== 'undefined') renderAll = __originalRender;
    
    // Si hay sesión iniciada, cargamos datos
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        loadDataFromSupabase();
    }
});