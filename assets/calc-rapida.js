// DMF · calculadora rápida de una sola comunidad.
// Usa el mismo motor que la calculadora completa (assets/calculadora.js -> window.CalculadoraDMF).
// No duplica tipos: los lee de datos-itp.js a través del motor.
(function () {
  "use strict";

  var cajas = document.querySelectorAll("[data-calc-rapida]");
  if (!cajas.length) return;

  var motor = window.CalculadoraDMF;
  if (!motor) return;

  var euros = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  });

  function linea(etiqueta, valor) {
    return '<div class="calc-rapida__linea"><span>' + etiqueta + "</span><strong>" + euros.format(valor) + "</strong></div>";
  }

  function pintar(caja) {
    var regimen = caja.getAttribute("data-regimen");
    var entrada = caja.querySelector("input[type=number]");
    var salida = caja.querySelector("[data-salida]");
    if (!entrada || !salida) return;

    var precio = parseFloat(entrada.value);
    if (!(precio > 0)) {
      salida.innerHTML = '<p class="campo__pista">Escribe un precio para ver el cálculo.</p>';
      return;
    }

    var r;
    try {
      r = motor.calcular(precio, regimen, false, false);
    } catch (e) {
      salida.innerHTML = '<p class="campo__pista">No hay datos para esta comunidad.</p>';
      return;
    }

    salida.innerHTML =
      linea("ITP (" + (r.regimen.tipo_orientativo * 100).toLocaleString("es-ES") + " % orientativo)", r.itp) +
      linea("Notaría", r.notaria) +
      linea("Registro", r.registro) +
      linea("Gestoría", r.gestoria) +
      '<div class="calc-rapida__total"><span>Gastos de la compra</span><strong>' +
      euros.format(r.gastos) + "</strong></div>" +
      '<div class="calc-rapida__linea"><span>Precio + gastos</span><strong>' + euros.format(r.total) + "</strong></div>" +
      '<div class="calc-rapida__linea"><span>Sobre el precio</span><strong>' +
      (r.porcentaje * 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " %</strong></div>";
  }

  cajas.forEach(function (caja) {
    var entrada = caja.querySelector("input[type=number]");
    if (entrada) {
      entrada.addEventListener("input", function () { pintar(caja); });
    }
    pintar(caja);
  });
})();
