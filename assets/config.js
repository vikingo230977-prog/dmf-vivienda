// Punto único de configuración de la web. Cambia aquí y se actualiza todo.
// No hay claves ni secretos en este archivo (nada que proteger si se publica).

window.DMF_CONFIG = {
  // Enlace de compra en Payhip. Mientras esté vacío, los botones llevan a la lista de avisos.
  // Producto publicado el 15-11-2026: «Comprar piso en España sin sustos» a 29 €.
  payhipUrl: "https://payhip.com/b/0tUCO",

  // Texto del botón cuando ya hay enlace de pago.
  ctaVenta: "Comprar el pack por 29 €",

  // Texto del botón mientras no hay producto publicado.
  ctaEspera: "Avísame cuando esté a la venta",

  // Formulario de Brevo (sibforms): "DMF Checklist vivienda" → lista "DMF - Checklist vivienda".
  // El POST mete el correo en la lista; la automatización de Brevo manda el checklist.
  brevoAction: "https://f3884859.sibforms.com/serve/MUIFAFxl7wp6onY0Ka02xZYsOin0i7oeo4ZjuwsylsxuVFoc4mBLFzOHEkDPhoOZTeB-nNkM34Q-nLzOgNAx28cJlSwFBri-qbmVboMrTJeVh8ZZ2iIjik7wZO4SZfh_8axtpfa8npOo4bfQGeiP3Rn8KT7z9OJl2C8-rFpO_c4Qi8FeA4nIfhB5Wzq3s6XbIH_-JzBL9bGs0b8CAg==",

  // Texto corto para el botón de la cabecera (no cabe el largo).
  ctaCorto: "Comprar",
  ctaEsperaCorto: "Avisadme",

  // Correo de contacto del sitio. Es el buzón real de la cuenta de Brevo.
  contacto: "hola@viviendaclara.es",

  // Versión de los datos fiscales que usa la calculadora (la escribe gen_web_datos.py).
  generado: ""
};

// Rellena los botones de compra y el año del pie en todas las páginas.
(function () {
  "use strict";

  // --- UTMs: cada botón de compra dice de qué página sale ---
  // Sin esto, Payhip devuelve "N ventas" y no de dónde vienen. La ruta manda:
  // /itp/andalucia/ -> utm_content=itp-andalucia. Se puede forzar por página con
  // <body data-utm-content="..." data-utm-campaign="...">.
  function slugDeRuta() {
    var p = (location.pathname || "/").replace(/^\/+|\/+$/g, "");
    if (!p) return "home";
    return p.replace(/\.html$/, "").replace(/\//g, "-");
  }

  function conUtm(url) {
    if (!url) return url;
    // Se limpia cualquier UTM previa: el href estático lleva utm_content=nav y
    // aquí se sustituye por la página real, sin duplicar parámetros.
    var base = url.split("#")[0].split("?")[0];
    var cuerpo = document.body || document.documentElement;
    var contenido = (cuerpo && cuerpo.getAttribute("data-utm-content")) || slugDeRuta();
    var campana = (cuerpo && cuerpo.getAttribute("data-utm-campaign")) || "contenido";
    return base + "?utm_source=viviendaclara&utm_medium=web" +
      "&utm_campaign=" + encodeURIComponent(campana) +
      "&utm_content=" + encodeURIComponent(contenido);
  }

  function aplicar() {
    var cfg = window.DMF_CONFIG || {};
    var hayVenta = !!cfg.payhipUrl;
    var destino = conUtm(cfg.payhipUrl);

    document.querySelectorAll("[data-cta-compra]").forEach(function (el) {
      if (hayVenta) {
        el.setAttribute("href", destino);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
        el.textContent = cfg.ctaVenta;
      } else {
        el.setAttribute("href", "#avisos");
        el.setAttribute("data-estado", "espera");
        el.textContent = cfg.ctaEspera;
      }
    });

    document.querySelectorAll("[data-cta-corto]").forEach(function (el) {
      if (hayVenta) {
        el.setAttribute("href", destino);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
        el.textContent = cfg.ctaCorto;
      } else {
        el.setAttribute("href", "#avisos");
        el.textContent = cfg.ctaEsperaCorto;
      }
    });

    document.querySelectorAll("[data-payhip-estado]").forEach(function (el) {
      el.textContent = hayVenta ? "A la venta: descarga inmediata al pagar" : "En preparación: apúntate y te aviso el día que abra";
    });

    document.querySelectorAll("[data-contacto]").forEach(function (el) {
      if (cfg.contacto) {
        el.setAttribute("href", "mailto:" + cfg.contacto);
        if (el.hasAttribute("data-contacto-texto")) el.textContent = cfg.contacto;
      }
    });

    document.querySelectorAll("[data-form-brevo]").forEach(function (form) {
      if (cfg.brevoAction) {
        form.setAttribute("action", cfg.brevoAction);
        form.removeAttribute("data-sin-brevo");
        form.removeAttribute("novalidate");
      } else {
        form.setAttribute("data-sin-brevo", "1");
      }
    });

    document.querySelectorAll("[data-anio]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicar);
  else aplicar();
})();

// Envío del formulario de Brevo sin sacar al visitante de la página: el POST va
// a un iframe oculto (Brevo no deja leer la respuesta desde otro dominio) y el
// mensaje de confirmación se pinta aquí mismo.
(function () {
  "use strict";
  function conectar() {
    document.querySelectorAll("[data-form-brevo]").forEach(function (form) {
      if (form.dataset.envioListo) return;
      form.dataset.envioListo = "1";

      var aviso = document.createElement("p");
      aviso.className = "form-aviso";
      aviso.setAttribute("role", "status");
      aviso.hidden = true;
      form.appendChild(aviso);

      form.addEventListener("submit", function (ev) {
        var cfg = window.DMF_CONFIG || {};
        var email = form.querySelector('input[name="EMAIL"]');
        var trampa = form.querySelector('input[name="email_address_check"]');

        function decir(texto, tipo) {
          aviso.hidden = false;
          aviso.textContent = texto;
          aviso.setAttribute("data-tipo", tipo);
        }

        // Robots que rellenan el campo oculto: se descarta sin decir nada.
        if (trampa && trampa.value) { ev.preventDefault(); return; }

        if (!cfg.brevoAction) {
          ev.preventDefault();
          decir("Este formulario todavía no está conectado. Si me escribes, te lo mando a mano.", "error");
          return;
        }
        if (!email || !email.checkValidity()) {
          ev.preventDefault();
          if (email) email.reportValidity();
          return;
        }

        ev.preventDefault();
        var marco = document.getElementById("marco-brevo");
        if (!marco) {
          marco = document.createElement("iframe");
          marco.id = "marco-brevo";
          marco.name = "marco-brevo";
          marco.style.display = "none";
          marco.setAttribute("aria-hidden", "true");
          marco.setAttribute("tabindex", "-1");
          marco.title = "Envío del formulario";
          document.body.appendChild(marco);
        }
        form.setAttribute("target", "marco-brevo");
        form.submit();
        form.reset();
        var entrega = form.parentElement.querySelector(".entrega");
        if (!entrega) {
          var bloque = form.closest(".captura");
          if (bloque) entrega = bloque.querySelector(".entrega");
        }
        if (entrega) entrega.hidden = false;
        decir("Listo. Ya lo tienes aquí abajo.", "ok");
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", conectar);
  else conectar();
})();

// Cabecera fija: al separarse del techo se le pone una sombra para que se lea
// sobre el contenido. Sin JS la cabecera sigue pegada y opaca, que es lo que importa.
(function () {
  "use strict";
  var cab = document.querySelector(".cabecera");
  if (!cab) return;
  var anterior = null;
  function pintar() {
    var pegado = window.scrollY > 8;
    if (pegado === anterior) return;
    anterior = pegado;
    cab.classList.toggle("cabecera--fija", pegado);
  }
  window.addEventListener("scroll", pintar, { passive: true });
  pintar();
})();
