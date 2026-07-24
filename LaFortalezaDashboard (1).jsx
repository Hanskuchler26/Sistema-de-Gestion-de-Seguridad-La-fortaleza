import { useState, useMemo } from "react";
import {
  Shield, Radio, Clock, CheckCircle2, AlertTriangle, Search,
  MapPin, User, Send, Activity, ChevronDown, ListChecks, Siren, X
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

// -----------------------------------------------------------------------
// PUNTOS DE CONTROL DEL RESIDENCIAL
// Ajusta esta lista a los puntos reales que recorre el guardia.
// -----------------------------------------------------------------------
const PUNTOS_CONTROL = [
  "Portón A", "Portón B", "Perímetro Norte", "Perímetro Sur",
  "Parque", "Cancha", "Zona Piscina", "Casa Club"
];

// -----------------------------------------------------------------------
// DATOS DE EJEMPLO
// En producción esto vendría de Supabase/Firebase (ver comentarios abajo
// en `handleRegistrar` y en el bloque final del archivo).
// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
// GUARDIAS AUTORIZADOS (LOGIN DE DEMOSTRACIÓN)
//
// ⚠ ADVERTENCIA DE SEGURIDAD:
// Este PIN está escrito directamente en el código del navegador, así que
// cualquiera que inspeccione la página puede verlo. Sirve para PROBAR el
// flujo de login con el jefe, pero NO debe usarse así en producción.
//
// Para un login real, reemplaza este arreglo y la función `handleLogin`
// por autenticación de Supabase o Firebase, por ejemplo:
//
//   Supabase Auth:
//   const { data, error } = await supabase.auth.signInWithPassword({
//     email: `${guardiaId}@lafortaleza.local`, password: pin,
//   });
//
//   Firebase Auth:
//   await signInWithEmailAndPassword(auth, email, password);
//
// Así las contraseñas nunca viajan ni se guardan en el código del cliente.
// -----------------------------------------------------------------------
const GUARDIAS_AUTORIZADOS = [
  { id: "jperez", nombre: "J. Pérez", pin: "1234" },
  { id: "mgomez", nombre: "M. Gómez", pin: "5678" },
  { id: "lrivas", nombre: "L. Rivas", pin: "9012" },
];

const RONDAS_INICIALES = [
  { id: 1, numero: 1, fecha: "2026-07-24", hora: "06:05", punto: "Portón A", estado: "Sin novedad", obs: "Turno iniciado sin incidentes.", guardia: "J. Pérez" },
  { id: 2, numero: 2, fecha: "2026-07-24", hora: "06:40", punto: "Parque", estado: "Sin novedad", obs: "Zona despejada.", guardia: "J. Pérez" },
  { id: 3, numero: 3, fecha: "2026-07-24", hora: "07:15", punto: "Perímetro Norte", estado: "Con incidencia", obs: "Malla perimetral floja cerca del poste 4.", guardia: "J. Pérez" },
];

export default function LaFortalezaDashboard() {
  const [rondas, setRondas] = useState(RONDAS_INICIALES);
  const [busqueda, setBusqueda] = useState("");

  const [form, setForm] = useState({
    punto: PUNTOS_CONTROL[0],
    estado: "Sin novedad",
    obs: "",
    guardia: "",
  });

  const [confirmacion, setConfirmacion] = useState("");

  const [sesion, setSesion] = useState(null);
  const [loginForm, setLoginForm] = useState({ id: GUARDIAS_AUTORIZADOS[0].id, pin: "" });
  const [loginError, setLoginError] = useState("");

  const handleLogin = () => {
    const guardia = GUARDIAS_AUTORIZADOS.find((g) => g.id === loginForm.id);
    if (guardia && guardia.pin === loginForm.pin) {
      setSesion(guardia);
      setForm((f) => ({ ...f, guardia: guardia.nombre }));
      setLoginError("");
      setLoginForm({ ...loginForm, pin: "" });
    } else {
      setLoginError("PIN incorrecto. Verifica e intenta de nuevo.");
    }
  };

  const handleLogout = () => {
    setSesion(null);
    setForm((f) => ({ ...f, guardia: "" }));
  };

  // ---------------------------------------------------------------------
  // BOTÓN DE PÁNICO / SOS
  //
  // Flujo actual (demo): el guardia confirma, se intenta capturar su
  // ubicación con la API del navegador, se crea una ronda marcada como
  // incidencia crítica y aparece un banner rojo fijo hasta que el jefe
  // la marca como atendida.
  //
  // PARA PRODUCCIÓN REAL, aquí es donde conectarías una notificación
  // instantánea al jefe, por ejemplo:
  //
  //   - SMS/llamada:      Twilio (https://www.twilio.com)
  //   - WhatsApp:         WhatsApp Business API o Twilio WhatsApp
  //   - Push al celular:  Firebase Cloud Messaging
  //   - Tiempo real:      Supabase Realtime / Firestore onSnapshot,
  //                        igual que el resto del historial de rondas.
  //
  // La ubicación GPS solo se obtiene si el navegador la permite; si el
  // guardia no da permiso o el dispositivo no la soporta, la alerta se
  // envía igual, sin coordenadas.
  // ---------------------------------------------------------------------
  const [alertaSOS, setAlertaSOS] = useState(null);
  const [confirmarSOS, setConfirmarSOS] = useState(false);

  const dispararSOS = () => {
    const ahora = new Date();
    const base = {
      id: Date.now(),
      guardia: sesion.nombre,
      punto: form.punto,
      hora: ahora.toTimeString().slice(0, 5),
      fecha: ahora.toISOString().slice(0, 10),
      ubicacion: null,
    };

    const registrarAlerta = (alerta) => {
      setAlertaSOS(alerta);
      notificarSOS(alerta);
      setRondas((prev) => [
        {
          id: alerta.id,
          numero: prev.length + 1,
          fecha: alerta.fecha,
          hora: alerta.hora,
          punto: alerta.punto,
          estado: "Con incidencia",
          obs: alerta.ubicacion
            ? `🚨 Alerta SOS activada. Ubicación: ${alerta.ubicacion}`
            : "🚨 Alerta SOS activada.",
          guardia: alerta.guardia,
        },
        ...prev,
      ]);
      setConfirmarSOS(false);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          registrarAlerta({ ...base, ubicacion: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
        },
        () => registrarAlerta(base), // permiso denegado o falló: se envía sin ubicación
        { timeout: 4000 }
      );
    } else {
      registrarAlerta(base);
    }
  };

  const resolverSOS = () => setAlertaSOS(null);

  // ---------------------------------------------------------------------
  // NOTIFICACIÓN AL TELÉFONO DEL JEFE
  //
  // Lo que hace este bloque (funciona sin backend):
  // Si el jefe abrió esta página en su celular y dio permiso, el navegador
  // le muestra una notificación nativa del sistema (con sonido) apenas se
  // active un SOS — igual que una notificación de WhatsApp o Gmail.
  // Limitación: solo funciona mientras tenga la página abierta (o en
  // segundo plano reciente, según el navegador). No llega si cerró la app
  // del todo o el celular está apagado.
  //
  // PARA QUE LLEGUE DE VERDAD SIN TENER LA PÁGINA ABIERTA (producción):
  // Se necesita un backend (por ejemplo una función serverless) que reciba
  // el evento de SOS y llame a un servicio externo, por ejemplo con Twilio:
  //
  //   // en un servidor / función serverless, NUNCA en el navegador:
  //   const twilio = require("twilio")(ACCOUNT_SID, AUTH_TOKEN);
  //   await twilio.messages.create({
  //     body: `🚨 SOS de ${alerta.guardia} en ${alerta.punto} (${alerta.hora})`,
  //     from: "+1XXXXXXXXXX",
  //     to: "+507XXXXXXX", // celular del jefe
  //   });
  //
  // O con WhatsApp Business API / Firebase Cloud Messaging de forma similar.
  // El front-end solo llamaría a tu propio endpoint (ej. fetch("/api/sos")),
  // nunca directamente a Twilio con la clave secreta expuesta.
  // ---------------------------------------------------------------------
  const [notifPermiso, setNotifPermiso] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const activarNotificaciones = async () => {
    if (typeof Notification === "undefined") {
      setNotifPermiso("unsupported");
      return;
    }
    const permiso = await Notification.requestPermission();
    setNotifPermiso(permiso);
  };

  const notificarSOS = (alerta) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification("🚨 Alerta SOS — La Fortaleza", {
        body: `${alerta.guardia} activó el SOS en ${alerta.punto} (${alerta.hora})`,
        tag: "sos-la-fortaleza",
      });
    } catch (e) {
      // Algunos navegadores móviles restringen esto fuera de un service worker;
      // el banner rojo en pantalla sigue funcionando como respaldo.
    }
  };

  // ---------------------------------------------------------------------
  // Registrar una nueva ronda (mock en tiempo real vía estado de React).
  //
  // CONEXIÓN CON SUPABASE / FIREBASE:
  // En lugar de `setRondas([nueva, ...rondas])`, aquí insertarías la fila
  // en tu tabla `rondas` de Supabase, por ejemplo:
  //
  //   const { data, error } = await supabase
  //     .from("rondas")
  //     .insert([{ punto: form.punto, estado: form.estado, obs: form.obs, guardia: form.guardia }]);
  //
  // o en Firebase (Firestore):
  //
  //   await addDoc(collection(db, "rondas"), {
  //     punto: form.punto, estado: form.estado, obs: form.obs,
  //     guardia: form.guardia, creado: serverTimestamp(),
  //   });
  //
  // El jefe vería la nueva ronda al instante suscribiéndose a cambios:
  //   supabase.channel("rondas").on("postgres_changes", { event: "INSERT", table: "rondas" }, cb)
  //   onSnapshot(collection(db, "rondas"), cb)   // Firestore
  // ---------------------------------------------------------------------
  const handleRegistrar = () => {
    const ahora = new Date();
    const nueva = {
      id: Date.now(),
      numero: rondas.length + 1,
      fecha: ahora.toISOString().slice(0, 10),
      hora: ahora.toTimeString().slice(0, 5),
      punto: form.punto,
      estado: form.estado,
      obs: form.obs.trim() || "Sin observaciones.",
      guardia: sesion.nombre,
    };

    // Actualización funcional: evita depender de un valor de "rondas"
    // potencialmente desactualizado si hay renders encolados.
    setRondas((prev) => [nueva, ...prev]);
    setBusqueda(""); // por si había un filtro activo que ocultara la nueva ronda
    setForm({ punto: PUNTOS_CONTROL[0], estado: "Sin novedad", obs: "", guardia: sesion.nombre });

    setConfirmacion(`✓ Ronda #${nueva.numero} registrada — ${nueva.punto} (${nueva.hora})`);
    setTimeout(() => setConfirmacion(""), 3500);
  };

  const hoyISO = new Date().toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const deHoy = rondas.filter((r) => r.fecha === hoyISO);
    const sinNovedad = rondas.filter((r) => r.estado === "Sin novedad").length;
    const incidencias = rondas.filter((r) => r.estado === "Con incidencia").length;
    return {
      totalHoy: deHoy.length,
      ultima: rondas[0] || null,
      sinNovedad,
      incidencias,
    };
  }, [rondas, hoyISO]);

  const datosGrafico = useMemo(() => ([
    { name: "Sin novedad", value: kpis.sinNovedad },
    { name: "Con incidencia", value: kpis.incidencias },
  ]), [kpis]);

  const rondasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rondas;
    return rondas.filter(
      (r) => r.punto.toLowerCase().includes(q) || r.estado.toLowerCase().includes(q)
    );
  }, [rondas, busqueda]);

  if (!sesion) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="p-3 bg-blue-950 border border-amber-500/40 rounded-xl mb-3">
              <Shield className="w-7 h-7 text-amber-400" strokeWidth={1.75} />
            </div>
            <h1 className="text-lg font-bold tracking-wide">LA FORTALEZA</h1>
            <p className="text-xs text-slate-400 mt-1">Acceso de guardias</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Guardia
              </label>
              <div className="relative">
                <select
                  value={loginForm.id}
                  onChange={(e) => setLoginForm({ ...loginForm, id: e.target.value })}
                  className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {GUARDIAS_AUTORIZADOS.map((g) => (
                    <option key={g.id} value={g.id}>{g.nombre}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={loginForm.pin}
                onChange={(e) => setLoginForm({ ...loginForm, pin: e.target.value })}
                placeholder="••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {loginError && (
              <p className="text-xs text-red-400">{loginError}</p>
            )}

            <button
              type="button"
              onClick={handleLogin}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm py-2.5 rounded-lg transition"
            >
              Entrar
            </button>

            <p className="text-xs text-slate-600 text-center pt-1">
              Demo: usa el PIN de prueba asignado a cada guardia.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {alertaSOS && (
        <div className="sticky top-0 z-40 bg-red-600 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <Siren className="w-4 h-4" />
            <span className="text-sm font-semibold">
              ALERTA SOS — {alertaSOS.guardia} en {alertaSOS.punto} ({alertaSOS.hora})
              {alertaSOS.ubicacion && <span className="font-normal"> · GPS: {alertaSOS.ubicacion}</span>}
            </span>
          </div>
          <button
            type="button"
            onClick={resolverSOS}
            className="text-xs font-medium bg-white text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50 transition"
          >
            Marcar como atendida
          </button>
        </div>
      )}

      {confirmarSOS && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-red-500/40 rounded-2xl p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center mb-4">
              <Siren className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-base font-semibold mb-1">¿Confirmar alerta SOS?</h3>
            <p className="text-sm text-slate-400 mb-5">
              Se notificará de inmediato como una emergencia en {form.punto}.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmarSOS(false)}
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 text-sm py-2.5 rounded-lg hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={dispararSOS}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-2.5 rounded-lg transition"
              >
                Sí, activar SOS
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setConfirmarSOS(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-5 py-3.5 rounded-full shadow-lg shadow-red-950/50 transition"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
        </span>
        <Siren className="w-4 h-4" /> SOS
      </button>

      <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ---------------- HEADER ---------------- */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950 border border-amber-500/40 rounded-xl">
              <Shield className="w-7 h-7 text-amber-400" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-wide text-slate-50">
                LA FORTALEZA
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Centro de monitoreo · Seguridad residencial
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {notifPermiso !== "granted" && notifPermiso !== "unsupported" && (
              <button
                type="button"
                onClick={activarNotificaciones}
                className="text-xs bg-slate-900 border border-amber-500/40 text-amber-300 rounded-full px-3 py-1.5 hover:bg-amber-500/10 transition"
              >
                Activar notificaciones en este celular
              </button>
            )}
            {notifPermiso === "granted" && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Notificaciones activas
              </span>
            )}
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-300">En vivo</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-full pl-3 pr-1 py-1">
              <span className="text-xs text-slate-300">{sesion.nombre}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-slate-500 hover:text-red-400 px-2 py-1 rounded-full transition"
              >
                Salir
              </button>
            </div>
          </div>
        </header>

        {/* ---------------- KPIs ---------------- */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={<ListChecks className="w-5 h-5" />} label="Rondas hoy" value={kpis.totalHoy} accent="text-slate-100" />
          <KpiCard
            icon={<Clock className="w-5 h-5" />}
            label="Última ronda"
            value={kpis.ultima ? `${kpis.ultima.hora}` : "—"}
            sub={kpis.ultima ? `${kpis.ultima.punto} · ${kpis.ultima.guardia}` : "Sin registros"}
            accent="text-amber-400"
          />
          <KpiCard icon={<CheckCircle2 className="w-5 h-5" />} label="Sin novedad" value={kpis.sinNovedad} accent="text-emerald-400" />
          <KpiCard icon={<AlertTriangle className="w-5 h-5" />} label="Incidencias" value={kpis.incidencias} accent="text-red-400" />
        </section>

        {/* ---------------- CUERPO PRINCIPAL ---------------- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Formulario — primero en mobile para el guardia */}
          <div className="order-1 lg:order-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 h-fit">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-400" /> Registrar ronda
            </h2>

            {confirmacion && (
              <div className={`mb-4 text-xs rounded-lg px-3 py-2 border ${
                confirmacion.startsWith("✓")
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}>
                {confirmacion}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Guardia en turno
                </label>
                <div className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300">
                  {sesion.nombre}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Punto de control
                </label>
                <div className="relative">
                  <select
                    value={form.punto}
                    onChange={(e) => setForm({ ...form, punto: e.target.value })}
                    className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {PUNTOS_CONTROL.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-2 block">Estado de la ronda</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, estado: "Sin novedad" })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition ${
                      form.estado === "Sin novedad"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Sin novedad
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, estado: "Con incidencia" })}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition ${
                      form.estado === "Con incidencia"
                        ? "bg-red-500/15 border-red-500 text-red-300"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Incidencia
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Observaciones</label>
                <textarea
                  value={form.obs}
                  onChange={(e) => setForm({ ...form, obs: e.target.value })}
                  placeholder="Detalles de la ronda..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleRegistrar}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm py-2.5 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Registrar ronda
              </button>
            </div>
          </div>

          {/* Gráfico + historial */}
          <div className="order-2 lg:order-1 lg:col-span-2 space-y-6">

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" /> Distribución del turno
              </h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={datosGrafico}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#e2e8f0" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                  Historial en vivo
                </h2>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por punto o estado..."
                    className="bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-56"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-800">
                      <th className="pb-2 pr-3 font-medium">N°</th>
                      <th className="pb-2 pr-3 font-medium">Hora</th>
                      <th className="pb-2 pr-3 font-medium">Punto</th>
                      <th className="pb-2 pr-3 font-medium">Estado</th>
                      <th className="pb-2 pr-3 font-medium">Guardia</th>
                      <th className="pb-2 font-medium">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rondasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          No hay rondas que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                    {rondasFiltradas.map((r) => (
                      <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-800/40">
                        <td className="py-2.5 pr-3 text-slate-400">#{r.numero}</td>
                        <td className="py-2.5 pr-3 text-slate-300">{r.hora}</td>
                        <td className="py-2.5 pr-3 text-slate-200">{r.punto}</td>
                        <td className="py-2.5 pr-3">
                          {r.estado === "Sin novedad" ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 text-xs">
                              <CheckCircle2 className="w-3 h-3" /> Sin novedad
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 text-xs">
                              <AlertTriangle className="w-3 h-3" /> Incidencia
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-300">{r.guardia}</td>
                        <td className="py-2.5 text-slate-400">{r.obs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <footer className="text-center text-xs text-slate-600 pt-2">
          La Fortaleza · Seguridad Residencial — datos sincronizados en tiempo real
        </footer>
      </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1 truncate">{sub}</div>}
    </div>
  );
}

// -----------------------------------------------------------------------
// SIGUIENTE PASO PARA TIEMPO REAL MULTI-DISPOSITIVO (Supabase ejemplo):
//
// 1. Crea una tabla `rondas` en Supabase con las columnas:
//    id, numero, fecha, hora, punto, estado, obs, guardia, creado_en
//
// 2. Al montar el componente, carga el historial existente:
//
//    useEffect(() => {
//      supabase.from("rondas").select("*").order("creado_en", { ascending: false })
//        .then(({ data }) => setRondas(data));
//    }, []);
//
// 3. Suscríbete a nuevas filas para que el jefe vea las rondas de otros
//    guardias sin recargar la página:
//
//    useEffect(() => {
//      const canal = supabase
//        .channel("rondas-realtime")
//        .on("postgres_changes", { event: "INSERT", schema: "public", table: "rondas" },
//          (payload) => setRondas((prev) => [payload.new, ...prev]))
//        .subscribe();
//      return () => supabase.removeChannel(canal);
//    }, []);
//
// 4. Cambia `handleRegistrar` para insertar en Supabase en vez de solo
//    actualizar el estado local (el listener de arriba se encarga de
//    reflejarlo en pantalla en cuanto Supabase confirma el insert).
// -----------------------------------------------------------------------
