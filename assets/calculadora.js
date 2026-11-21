// DMF · motor y interfaz de la calculadora de gastos de compra.
// Depende de assets/datos-itp.js (window.DATOS_ITP). Cero dependencias externas.

(function () {
  "use strict";

  var DATOS = window.DATOS_ITP;
  if (!DATOS) { console.error("Falta assets/datos-itp.js"); return; }

  // ---------- motor ----------

  // Cuota progresiva: cada tramo grava solo la parte del precio que cae dentro de él.
  // Con escalaUnica (Madrid, Comunitat Valenciana) el tipo NO es progresivo: se busca el
  // tramo en el que cae el precio y ese tipo se aplica a todo el valor.
  function cuotaITP(tramos, precio, escalaUnica) {
    if (escalaUnica) {
      for (var k = 0; k < tramos.length; k++) {
        var u = tramos[k];
        if (precio > u.desde && precio <= u.hasta) {
          var c = precio * u.tipo;
          return { total: c, detalle: [{ desde: 0, hasta: precio, tipo: u.tipo, base: precio, cuota: c }] };
        }
      }
    }
    var total = 0, detalle = [];
    for (var i = 0; i < tramos.length; i++) {
      var t = tramos[i];
      var base = Math.min(precio, t.hasta) - t.desde;
      if (base <= 0) continue;
      var cuota = base * t.tipo;
      total += cuota;
      detalle.push({ desde: Math.max(t.desde, 0), hasta: Math.min(precio, t.hasta), tipo: t.tipo, base: base, cuota: cuota });
    }
    return { total: total, detalle: detalle };
  }

  function buscarRegimen(nombre) {
    for (var i = 0; i < DATOS.regimenes.length; i++) {
      if (DATOS.regimenes[i].nombre === nombre) return DATOS.regimenes[i];
    }
    return null;
  }

  function calcular(precio, nombreRegimen, obraNueva, conHipoteca) {
    var reg = buscarRegimen(nombreRegimen);
    // Nunca caer en otra comunidad en silencio: un nombre que no existe es un fallo de datos,
    // y devolver la cuota de otra región es peor que no devolver nada.
    if (!reg) throw new Error("Comunidad no encontrada en datos-itp.js: " + nombreRegimen);
    var c = DATOS.conceptos;
    var r = { regimen: reg, precio: precio, obraNueva: !!obraNueva, conHipoteca: !!conHipoteca };

    if (obraNueva) {
      r.impuestoNombre = "IVA (10 %)";
      r.impuesto = precio * c.iva_obra_nueva;
      r.ajdNombre = "AJD (actos jurídicos documentados)";
      r.ajd = precio * reg.ajd;
      r.desgloseITP = [];
      r.itp = 0;
    } else {
      var itp = cuotaITP(reg.tramos, precio, reg.escala_unica);
      r.itp = itp.total;
      r.desgloseITP = itp.detalle;
      r.impuestoNombre = "ITP (impuesto de transmisiones)";
      r.impuesto = itp.total;
      r.ajdNombre = null;
      r.ajd = 0;
    }

    // Gastos de terceros con la misma lógica que la hoja «Gastos compra» del Excel:
    // gestoría y tasación en euros fijos, notaría y registro por escala decreciente.
    r.notaria = cuotaITP(c.arancel_notaria, precio).total;
    r.registro = cuotaITP(c.arancel_registro, precio).total;
    r.gestoria = c.gestoria;
    r.tasacion = r.conHipoteca ? c.tasacion : 0;

    r.gastos = r.impuesto + r.ajd + r.notaria + r.registro + r.gestoria + r.tasacion;
    r.total = precio + r.gastos;
    r.porcentaje = precio > 0 ? r.gastos / precio : 0;

    // Lo que pediría una calculadora que aplica un solo tipo (el orientativo del primer tramo).
    var primerTipo = reg.tramos[0].tipo;
    r.itpPlano = precio * primerTipo;
    r.sobrecoste = !obraNueva && r.itp > r.itpPlano ? r.itp - r.itpPlano : 0;

    return r;
  }

  // ---------- formato ----------
  var euros2 = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var pct = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 2 });

  function e0(n) {
    // Intl en es-ES no agrupa los millares de 4 cifras (1092, no 1.092) y en una
    // tabla de importes eso se lee como un error. Agrupamos siempre.
    var s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 ? "-" : "") + s + "\u00a0€";
  }
  function e2(n) { return euros2.format(n); }
  function p2(n) { return pct.format(n); }

  // ---------- interfaz ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function opcionesComunidad() {
    var grupos = { "Comunidades": [], "País Vasco": [], "Ciudades autónomas": [] };
    DATOS.regimenes.forEach(function (r) { (grupos[r.grupo] || grupos["Comunidades"]).push(r); });
    var html = "";
    Object.keys(grupos).forEach(function (g) {
      if (!grupos[g].length) return;
      html += '<optgroup label="' + esc(g) + '">';
      grupos[g].forEach(function (r) {
        html += '<option value="' + esc(r.nombre) + '">' + esc(r.nombre) + "</option>";
      });
      html += "</optgroup>";
    });
    return html;
  }

  function montar(raiz) {
    var id = raiz.id || "calc";
    var porDefecto = raiz.getAttribute("data-comunidad") || "Andalucía";
    var precioDefecto = raiz.getAttribute("data-precio") || "180000";

    raiz.innerHTML =
      '<div class="calc">' +
        '<div class="calc__cabecera">' +
          '<h2 id="' + id + '-titulo">¿Cuánto se te va en gastos?</h2>' +
          "<p>ITP por tramos, AJD y gastos de terceros. Sin registro.</p>" +
        "</div>" +
        '<div class="calc__cuerpo">' +
          '<div class="campo">' +
            '<label for="' + id + '-precio">Precio del inmueble (€)</label>' +
            '<input id="' + id + '-precio" type="number" inputmode="numeric" min="0" step="1000" value="' + esc(precioDefecto) + '">' +
            '<span class="campo__pista" id="' + id + '-precio-pista">El precio de la escritura, no lo que pides de hipoteca.</span>' +
          "</div>" +
          '<div class="campo">' +
            '<label for="' + id + '-comunidad">Dónde está el inmueble</label>' +
            '<select id="' + id + '-comunidad">' + opcionesComunidad() + "</select>" +
          "</div>" +
          '<div class="campo">' +
            '<span class="campo__pista" id="' + id + '-tipo-label">Tipo de vivienda</span>' +
            '<div class="segmento" role="radiogroup" aria-labelledby="' + id + '-tipo-label">' +
              '<input type="radio" name="' + id + '-obra" id="' + id + '-usada" value="usada" checked>' +
              '<label for="' + id + '-usada">Segunda mano</label>' +
              '<input type="radio" name="' + id + '-obra" id="' + id + '-nueva" value="nueva">' +
              '<label for="' + id + '-nueva">Obra nueva</label>' +
            "</div>" +
          "</div>" +
          '<div class="campo campo--casilla">' +
            '<input type="checkbox" id="' + id + '-hipoteca" checked>' +
            '<label for="' + id + '-hipoteca">Voy a pedir hipoteca</label>' +
            '<span class="campo__pista">Añade la tasación (350 €), que el banco exige. Desmárcalo si pagas al contado.</span>' +
          "</div>" +
        "</div>" +
        '<div class="resultado" aria-live="polite">' +
          '<div class="resultado__total"><span>Gastos además del precio</span><strong id="' + id + '-total">—</strong></div>' +
          '<ul class="resultado__lineas" id="' + id + '-lineas"></ul>' +
          '<p class="resultado__comparativa" id="' + id + '-comparativa"></p>' +
          '<p class="resultado__nota" id="' + id + '-nota"></p>' +
        "</div>" +
      "</div>";

    var $precio = raiz.querySelector("#" + id + "-precio");
    var $com = raiz.querySelector("#" + id + "-comunidad");
    var $nueva = raiz.querySelector("#" + id + "-nueva");
    var $hip = raiz.querySelector("#" + id + "-hipoteca");
    var $total = raiz.querySelector("#" + id + "-total");
    var $lineas = raiz.querySelector("#" + id + "-lineas");
    var $comp = raiz.querySelector("#" + id + "-comparativa");
    var $nota = raiz.querySelector("#" + id + "-nota");
    var $pista = raiz.querySelector("#" + id + "-precio-pista");

    $com.value = porDefecto;
    if ($com.value !== porDefecto) $com.selectedIndex = 0;

    function pintar() {
      var precio = Number($precio.value) || 0;
      var r;
      try {
        r = calcular(precio, $com.value, $nueva.checked, $hip.checked);
      } catch (e) {
        $total.textContent = "—";
        $lineas.innerHTML = "";
        $comp.textContent = "";
        $nota.textContent = "Error de datos: " + e.message + ". Recarga la página y, si sigue, avisa.";
        return;
      }
      if ($pista) {
        $pista.textContent = r.obraNueva
          ? "Precio SIN IVA (el 10 % se suma aparte). Si el anuncio ya lo incluye, quita el IVA antes de escribirlo."
          : "El precio de la escritura, no lo que pides de hipoteca.";
      }

      if (precio <= 0) {
        $total.textContent = "—";
        $lineas.innerHTML = "";
        $comp.textContent = "";
        $nota.textContent = "Escribe el precio para ver el desglose.";
        return;
      }

      $total.textContent = e0(r.gastos);

      var filas = [];
      if (r.obraNueva) {
        filas.push([r.impuestoNombre, e0(r.impuesto), "(sobre el precio)"]);
        filas.push([r.ajdNombre, e0(r.ajd), "(" + p2(r.regimen.ajd) + ")"]);
      } else {
        filas.push([r.impuestoNombre, e0(r.itp), " (" + p2(precio ? r.itp / precio : 0) + " efectivo)"]);
      }
      filas.push(["Notaría", e0(r.notaria), "(escala decreciente)"]);
      filas.push(["Registro de la propiedad", e0(r.registro), "(escala decreciente)"]);
      filas.push(["Gestoría", e0(r.gestoria), "(fijo)"]);
      if (r.tasacion > 0) filas.push(["Tasación", e0(r.tasacion), "(fijo, la exige el banco)"]);

      var html = "";
      filas.forEach(function (f, i) {
        html += "<li><span>" + esc(f[0]) + "<span class=\"sub\">" + esc(f[2]) + "</span></span><span class=\"num\">" + f[1] + "</span></li>";
        // Bajo la línea del ITP va el desglose tramo a tramo: es la razón de ser de esta calculadora.
        if (i === 0 && !r.obraNueva && r.desgloseITP.length > 1) {
          r.desgloseITP.forEach(function (t) {
            html += "<li class=\"escala-detalle\"><span>" + e0(t.desde) + " – " + e0(t.hasta) + " al " + p2(t.tipo) +
                    "</span><span class=\"num\">" + e0(t.cuota) + "</span></li>";
          });
        }
      });
      html += "<li><span><strong>Total operación</strong></span><span class=\"num\"><strong>" + e0(r.total) + "</strong></span></li>";
      $lineas.innerHTML = html;

      if (r.sobrecoste > 1) {
        $comp.innerHTML = "Una calculadora que aplique el " + p2(r.regimen.tramos[0].tipo) +
          " plano te diría " + e0(r.itpPlano) + ": " + e0(r.sobrecoste) +
          " menos de lo que toca en " + esc(r.regimen.nombre) + ".";
      } else if (r.obraNueva) {
        $comp.innerHTML = "En obra nueva no hay ITP: pagas IVA al 10 % más AJD del " + p2(r.regimen.ajd) +
          ". Escribe el precio SIN IVA: si la cifra que tienes ya lo lleva dentro, el 10 % se sumaría dos veces.";
      } else {
        $comp.innerHTML = "";
      }

      $nota.textContent = "Notaría y registro, escala decreciente por valor; gestoría 450 € y tasación 350 € en fijo. Los aranceles reales varían por notaría y registro. Datos de " + DATOS.generado + ".";
    }

    ["input", "change"].forEach(function (ev) {
      $precio.addEventListener(ev, pintar);
      $com.addEventListener(ev, pintar);
      $nueva.addEventListener(ev, pintar);
      $hip.addEventListener(ev, pintar);
      raiz.querySelector("#" + id + "-usada").addEventListener(ev, pintar);
    });
    pintar();

    raiz._calcular = calcular; // para pruebas
    raiz._pintar = pintar;
  }

  // La tabla de escalas vive en el HTML (la escribe herramientas/gen_web_estatico.py):
  // así Google y los rastreadores de IA la leen sin ejecutar JavaScript.

  function iniciar() {
    var nodos = document.querySelectorAll("[data-calc]");
    for (var i = 0; i < nodos.length; i++) montar(nodos[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  // Expuesto para las pruebas automáticas (node y consola del navegador).
  window.CalculadoraDMF = { calcular: calcular, cuotaITP: cuotaITP, datos: DATOS };
})();
