'use strict';
/* Páginas institucionais: Sobre, Serviços, Soluções, Contactos, Privacidade, Termos.
   Conteúdo retirado da apresentação institucional da SENA EXECUTIVA. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const page = location.pathname.replace(/\/+$/, '').slice(1);
  const num = (i) => String(i + 1).padStart(2, '0');

  const hero = (kicker, title, lead, actions = '') =>
    `<section class="ph"><div class="wrap"><span class="kicker">${kicker}</span><h1>${title}<span class="dot">.</span></h1><p class="lead">${lead}</p>${actions}</div></section>`;
  const head = (kicker, title, lead = '') =>
    `<div class="sec-t rev"><span class="kicker">${kicker}</span><h2>${title}</h2>${lead ? `<p>${lead}</p>` : ''}</div>`;
  const band = `<section class="band2"><div class="wrap in rev"><div><h2>Uma plataforma para <em>informar, posicionar e conectar.</em></h2><div class="tags"><span>Media</span><span>Branding</span><span>Intelligence</span><span>Events</span></div></div><a class="btn-gold" href="/contacto">Fale connosco →</a></div></section>`;

  const pages = {};

  /* ============ SOBRE ============ */
  const valores = [
    ['Credibilidade', 'Informação verificada, fontes fiáveis e confiança construída a cada edição.'],
    ['Rigor', 'Precisão nos factos, nos números e na análise de cada tema.'],
    ['Independência', 'Linha editorial livre, com separação clara entre jornalismo e conteúdo comercial.'],
    ['Inovação', 'Formatos digitais modernos para uma audiência exigente e em movimento.'],
    ['Excelência', 'Padrões elevados em conteúdo, design e relação com parceiros.'],
    ['Responsabilidade', 'Consciência do impacto da informação no desenvolvimento do país.'],
  ];
  const areas = ['Economia e Finanças', 'Banca e Seguros', 'Energia e Mineração', 'Transportes e Logística', 'Tecnologia e Inovação', 'Direito e Governação', 'Indústria e Agricultura', 'Construção e Imobiliário', 'Investimento', 'Liderança e Capital Humano'];

  pages.sobre = {
    title: 'Sobre nós',
    html: () =>
      hero('Quem somos', 'Onde a informação encontra a liderança', 'Mais do que uma revista, somos uma plataforma de comunicação, conhecimento e conexões estratégicas.') +
      `<section class="sec"><div class="wrap cols2">
        <div class="prose rev">
          <p>A <strong>SENA EXECUTIVA</strong> é uma revista digital dedicada a acompanhar, interpretar e dar visibilidade às <strong>empresas, aos líderes e às decisões</strong> que impulsionam o desenvolvimento de Angola.</p>
          <p>Nascemos para aproximar a informação de quem decide — valorizando histórias empresariais, estratégias de liderança, investimentos e as transformações que moldam o presente e o futuro da economia angolana.</p>
        </div>
        <div class="rev"><p class="quote">Aqui, as ideias ganham relevância e os protagonistas ganham voz.</p></div>
      </div></section>` +
      `<section class="sec alt"><div class="wrap">${head('Propósito', 'Informar com rigor. Inspirar quem decide.')}
        <div class="g2">
          <article class="pc big rev"><span class="tag">Missão</span><h3>Credibilidade ao serviço da economia angolana.</h3><p>Produzir e divulgar informação credível, relevante e estratégica, promovendo o conhecimento, a valorização das empresas e o reconhecimento dos protagonistas da economia angolana.</p></article>
          <article class="pc big rev"><span class="tag">Visão</span><h3>A plataforma digital de referência em negócios e liderança.</h3><p>Ser reconhecida em Angola pela qualidade editorial, credibilidade e capacidade de aproximar empresas, instituições e decisores.</p></article>
        </div></div></section>` +
      `<section class="sec"><div class="wrap">${head('Valores', 'Os princípios que nos orientam.')}
        <div class="g3">${valores.map((v, i) => `<article class="pc rev"><span class="n">${num(i)}</span><h3>${v[0]}</h3><p>${v[1]}</p></article>`).join('')}</div></div></section>` +
      `<section class="sec alt"><div class="wrap">${head('Áreas de actuação', 'Os sectores que movem o país.', 'Acompanhamos de perto os principais motores da economia angolana.')}
        <div class="chips2">${areas.map((a, i) => `<div class="rev"><span>${num(i)}</span>${a}</div>`).join('')}</div></div></section>` +
      `<section class="sec"><div class="wrap">${head('O nosso compromisso', 'Uma plataforma onde a informação inspira, o conhecimento aproxima e as conexões criam oportunidades.', 'Acreditamos que:')}
        <div class="g3 beliefs">
          <article class="pc rev"><span class="n">EMPRESAS</span><h3>Uma história</h3><p>Cada empresa tem <b>uma história</b> que merece ser contada.</p></article>
          <article class="pc rev"><span class="n">PESSOAS</span><h3>Uma visão</h3><p>Cada líder tem <b>uma visão</b> que merece ser conhecida.</p></article>
          <article class="pc rev"><span class="n">DECISÕES</span><h3>Novos caminhos</h3><p>Cada decisão pode abrir <b>novos caminhos</b> para o desenvolvimento nacional.</p></article>
        </div></div></section>` + band,
  };

  /* ============ SERVIÇOS ============ */
  const unidades = [
    ['SENA', 'MEDIA', 'Visibilidade com credibilidade', ['Publicidade digital', 'Entrevistas executivas', 'Reportagens empresariais', 'Conteúdos patrocinados', 'Cobertura de eventos']],
    ['SENA', 'BRANDING', 'Reputação que se constrói', ['Posicionamento corporativo', 'Comunicação institucional', 'Perfis empresariais', 'Valorização da imagem de executivos']],
    ['SENA', 'INTELLIGENCE', 'Conhecimento para decidir', ['Análises económicas', 'Estudos de mercado', 'Relatórios sectoriais', 'Newsletters executivas']],
    ['SENA', 'EVENTS', 'Conexões que geram valor', ['Fóruns empresariais', 'Conferências', 'Encontros institucionais', 'Networking corporativo']],
  ];
  pages.servicos = {
    title: 'Os nossos serviços',
    html: () =>
      hero('Os nossos serviços', 'Quatro unidades. Uma só visão', 'Soluções de media, branding, inteligência de mercado e eventos pensadas para o universo executivo angolano.', '<div class="act"><a class="btn-gold" href="/contacto">Agendar consultoria →</a></div>') +
      `<section class="sec"><div class="wrap"><div class="g2">${unidades.map((u) => `<article class="unit rev"><div class="nm"><small>${u[0]}</small>${u[1]}<i>.</i></div><h3>${u[2]}</h3><ul>${u[3].map((x) => `<li>${x}</li>`).join('')}</ul></article>`).join('')}</div>
        <div class="note rev"><div><b>Compromisso editorial</b><p>Mantemos uma distinção clara entre conteúdos jornalísticos e conteúdos comerciais — a base da nossa credibilidade.</p></div></div></div></section>` + band,
  };

  /* ============ SOLUÇÕES ============ */
  const pilares = [
    ['Informação', 'Cobertura atenta da actualidade económica e empresarial.'],
    ['Análise', 'Contexto e leitura estratégica para lá da notícia.'],
    ['Comunicação estratégica', 'Soluções à medida para marcas, empresas e líderes.'],
    ['Foco corporativo', 'Uma abordagem editorial pensada para o universo executivo.'],
  ];
  const publicos = [
    ['Líderes e decisores', 'Administradores, gestores de topo e executivos que definem o rumo das organizações.'],
    ['Empresas e grupos económicos', 'Organizações que procuram visibilidade, posicionamento e reputação.'],
    ['Instituições', 'Entidades públicas, reguladores e associações sectoriais.'],
    ['Investidores e parceiros', 'Agentes nacionais e internacionais atentos às oportunidades em Angola.'],
  ];
  pages.solucoes = {
    title: 'Soluções',
    html: () =>
      hero('O nosso diferencial', 'Não comunicamos apenas acontecimentos. Revelamos decisões', 'Procuramos compreender as decisões, conhecer os protagonistas e contar as histórias que estão a transformar Angola.', '<div class="act"><a class="btn-gold" href="/contacto">Fale connosco →</a><a class="btn-outline" style="border-color:#fff;color:#fff" href="/servicos">Ver serviços</a></div>') +
      `<section class="sec"><div class="wrap">${head('Como trabalhamos', 'Quatro pilares para cada solução.')}
        <div class="g4">${pilares.map((p, i) => `<article class="pc rev"><span class="n">${num(i)}</span><h3>${p[0]}</h3><p>${p[1]}</p></article>`).join('')}</div>
        <div class="note rev"><div><b>Compromisso editorial</b><p>Mantemos uma distinção clara entre conteúdos jornalísticos e conteúdos comerciais — a base da nossa credibilidade.</p></div></div></div></section>` +
      `<section class="sec alt"><div class="wrap">${head('Audiência', 'Falamos com quem decide.', 'Para quem escrevemos.')}
        <div class="g4">${publicos.map((p, i) => `<article class="pc rev"><span class="n">${num(i)}</span><h3>${p[0]}</h3><p>${p[1]}</p></article>`).join('')}</div></div></section>` + band,
  };

  /* ============ CONTACTOS ============ */
  const ic = {
    tel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h3.5l1.8 4.3-2.2 1.5a12 12 0 0 0 6.1 6.1l1.5-2.2 4.3 1.8V19a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.2 2 2 0 0 1 5 4"/></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg>',
    web: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>',
    pin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11"/><circle cx="12" cy="10" r="2.6"/></svg>',
  };
  pages.contacto = {
    title: 'Contactos',
    html: () =>
      hero('Contactos', 'Fale com a SENA EXECUTIVA', 'Não contamos apenas o que acontece. Procuramos compreender o que move Angola. Partilhe connosco a sua ideia, parceria ou pedido de informação.') +
      `<section class="sec"><div class="wrap cols2">
        <form class="cform rev" id="contact" novalidate>
          <label for="cn">Nome</label><input id="cn" name="name" maxlength="120" required autocomplete="name">
          <label for="ce">E-mail</label><input id="ce" type="email" name="email" required autocomplete="email">
          <label for="cs">Assunto</label><input id="cs" name="subject" maxlength="200" required>
          <label for="cm">Mensagem</label><textarea id="cm" name="message" maxlength="5000" required></textarea>
          <button class="btn-gold" type="submit">Enviar mensagem</button>
          <p class="reply" id="reply" aria-live="polite"></p>
        </form>
        <div class="cinfo rev" id="details">
          <div class="it"><span class="ic">${ic.tel}</span><div><small>Telefone</small><a id="dTel" href="tel:+244942620546">(+244) 942 620 546</a></div></div>
          <div class="it"><span class="ic">${ic.mail}</span><div><small>E-mail</small><a id="dMail" href="mailto:geral@senaexecutiva.ao">geral@senaexecutiva.ao</a></div></div>
          <div class="it"><span class="ic">${ic.web}</span><div><small>Website</small><a href="https://www.senaexecutiva.ao" target="_blank" rel="noopener">www.senaexecutiva.ao</a></div></div>
          <div class="it"><span class="ic">${ic.pin}</span><div><small>Localização</small><span class="v" id="dLoc">Luanda, Angola</span></div></div>
        </div>
      </div></section>`,
    after() {
      fetch('/api/public/settings').then((r) => (r.ok ? r.json() : null)).then((s) => {
        if (!s) return;
        if (s.phone) { $('#dTel').textContent = s.phone; $('#dTel').href = 'tel:' + String(s.phone).replace(/[^\d+]/g, ''); }
        if (s.email) { $('#dMail').textContent = s.email; $('#dMail').href = 'mailto:' + s.email; }
        if (s.location) $('#dLoc').textContent = s.location;
      }).catch(() => {});
      $('#contact').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target, out = $('#reply'), btn = $('button', f);
        if (!f.checkValidity()) { f.reportValidity(); return; }
        btn.disabled = true; out.style.color = '';
        try {
          const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
          const x = await r.json().catch(() => ({}));
          out.textContent = r.ok ? 'Mensagem recebida. A nossa equipa responderá através do e-mail indicado.' : (x.error || 'Não foi possível enviar. Tente novamente.');
          out.style.color = r.ok ? 'var(--gold-text)' : '#c0392b';
          if (r.ok) f.reset();
        } catch { out.textContent = 'Sem ligação ao servidor. Tente novamente.'; out.style.color = '#c0392b'; }
        btn.disabled = false;
      });
    },
  };

  /* ============ LEGAIS ============ */
  const legal = (title, kicker, text) => ({
    title,
    html: () => hero(kicker, title, 'SENA EXECUTIVA') + `<section class="sec"><div class="wrap legal prose"><p>${text}</p><p><a class="btn-outline" href="/contacto">Contactar a equipa →</a></p></div></section>`,
  });
  pages.privacidade = legal('Política de privacidade', 'Legal', 'Os dados submetidos nos formulários são utilizados para responder aos contactos e gerir as subscrições solicitadas. Poderá solicitar esclarecimentos, acesso ou eliminação dos seus dados através do endereço institucional.');
  pages.termos = legal('Termos de utilização', 'Legal', 'O conteúdo editorial destina-se a fins informativos. A reprodução depende de autorização. A utilização desta plataforma deve respeitar os direitos dos titulares e a legislação aplicável.');

  /* ============ RENDER ============ */
  const main = $('#main');
  const p = pages[page];
  if (p) {
    document.title = p.title + ' · SENA EXECUTIVA';
    main.innerHTML = p.html();
  } else {
    document.title = 'Página não encontrada · SENA EXECUTIVA';
    main.innerHTML = hero('Erro 404', 'Página não encontrada', 'Regresse ao website para continuar.', '<div class="act"><a class="btn-gold" href="/">Ir para o blog →</a></div>');
  }
  $$('#mainNav a').forEach((a) => { if (a.dataset.p === page) a.classList.add('on'); });
  $('#today').textContent = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  /* tema */
  const ico = {
    sun: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>',
  };
  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); };
  function setTheme(t, announce) {
    document.documentElement.setAttribute('data-theme', t);
    $('#theme').innerHTML = t === 'dark' ? ico.sun : ico.moon;
    $('#theme').setAttribute('aria-label', t === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
    try { localStorage.setItem('sena-theme', t); } catch (e) {}
    if (announce) toast(t === 'dark' ? 'Modo escuro ativo' : 'Modo claro ativo');
  }
  $('#theme').addEventListener('click', () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true));
  setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  /* gaveta, scroll, topo */
  const closeDrawer = () => { $('#drawer').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false'); };
  $('#burger').addEventListener('click', () => { $('#drawer').classList.add('open'); $('#burger').setAttribute('aria-expanded', 'true'); });
  $('#closeDrawer').addEventListener('click', closeDrawer);
  $('#drawer').addEventListener('click', (e) => { if (e.target.closest('a')) closeDrawer(); });
  addEventListener('scroll', () => {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    $('#hdr').classList.toggle('stuck', y > 8);
    $('#progress').style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    $('#top').classList.toggle('on', y > 800);
  }, { passive: true });
  $('#top').addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  /* categorias do rodapé (geridas no admin) */
  fetch('/api/public/categories', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : [])).then((cs) => {
    const top = (cs || []).filter((c) => c.top);
    if (top.length) $('#footCats').innerHTML = top.map((c) => `<a href="/#${encodeURIComponent(c.k)}">${esc(c.k)}</a>`).join('');
  }).catch(() => {});

  /* revelação */
  const revs = $$('.rev');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -40px 0px' });
    revs.forEach((el) => io.observe(el));
  } else revs.forEach((el) => el.classList.add('in'));

  if (p && p.after) p.after();
})();
