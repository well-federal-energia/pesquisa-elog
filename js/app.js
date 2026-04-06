// ===== CONFIGURAÇÃO =====
const CONFIG = {
    // URL do Power Automate HTTP Trigger (substituir pela URL real)
    POWER_AUTOMATE_URL: '',
    // Tempo de bloqueio em milissegundos (12 horas)
    BLOQUEIO_MS: 12 * 60 * 60 * 1000,
    // Chaves do localStorage
    STORAGE_KEY: 'elog_pesquisa',
    FINGERPRINT_KEY: 'elog_fingerprint',
    QUEUE_KEY: 'elog_queue'
};

// ===== ESTADO DA APLICAÇÃO =====
const state = {
    telaAtual: 1,
    totalTelas: 5,
    respostas: {},
    enviado: false
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    if (verificarBloqueio()) return;
    inicializarComponentes();
    carregarRascunho();
    sincronizarFilaOffline();
});

// ===== FINGERPRINT DO NAVEGADOR =====
function gerarFingerprint() {
    const dados = [
        navigator.userAgent,
        navigator.language,
        screen.width + 'x' + screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || '',
        navigator.maxTouchPoints || ''
    ].join('|');

    let hash = 0;
    for (let i = 0; i < dados.length; i++) {
        const char = dados.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return 'fp_' + Math.abs(hash).toString(36);
}

function verificarBloqueio() {
    const fp = gerarFingerprint();
    const registro = localStorage.getItem(CONFIG.FINGERPRINT_KEY);

    if (registro) {
        try {
            const dados = JSON.parse(registro);
            if (dados.fingerprint === fp) {
                const agora = Date.now();
                const diff = agora - dados.timestamp;
                if (diff < CONFIG.BLOQUEIO_MS) {
                    document.getElementById('app').style.display = 'none';
                    document.getElementById('tela-bloqueio').style.display = 'block';
                    return true;
                }
            }
        } catch (e) {
            localStorage.removeItem(CONFIG.FINGERPRINT_KEY);
        }
    }
    return false;
}

function registrarEnvio() {
    const fp = gerarFingerprint();
    localStorage.setItem(CONFIG.FINGERPRINT_KEY, JSON.stringify({
        fingerprint: fp,
        timestamp: Date.now()
    }));
}

// ===== COMPONENTES =====
function inicializarComponentes() {
    inicializarVeiculos();
    inicializarStars();
    inicializarOpcoes();
    inicializarNPS();
    inicializarCheckOutros();
    inicializarBotoes();
    inicializarSelect();
}

// --- Select (Região) ---
function inicializarSelect() {
    const select = document.getElementById('regiao');
    select.addEventListener('change', () => {
        state.respostas.regiao = select.value;
        validarTela(1);
    });
}

// --- Veículos ---
function inicializarVeiculos() {
    const outroWrapper = document.getElementById('veiculo-outro-wrapper');
    const outroInput = document.getElementById('veiculo-outro-text');

    document.querySelectorAll('.veiculo-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.veiculo-btn').forEach(b => b.classList.remove('selecionado'));
            btn.classList.add('selecionado');

            if (btn.dataset.value === 'Outro') {
                outroWrapper.style.display = 'block';
                outroInput.focus();
                state.respostas.veiculo = outroInput.value.trim() ? outroInput.value.trim() : '';
            } else {
                outroWrapper.style.display = 'none';
                outroInput.value = '';
                state.respostas.veiculo = btn.dataset.value;
            }
            validarTela(1);
        });
    });

    outroInput.addEventListener('input', () => {
        state.respostas.veiculo = outroInput.value.trim() ? outroInput.value.trim() : '';
        validarTela(1);
    });
}

// --- Star Ratings ---
function inicializarStars() {
    document.querySelectorAll('.star-rating').forEach(rating => {
        const stars = rating.querySelectorAll('.star');
        const name = rating.dataset.name;

        stars.forEach(star => {
            star.addEventListener('click', () => {
                const valor = parseInt(star.dataset.value);
                state.respostas[name] = valor;

                stars.forEach(s => {
                    s.classList.toggle('ativa', parseInt(s.dataset.value) <= valor);
                });

                // Lógica condicional: nota ≤ 3
                tratarLogicaCondicional(name, valor);
                validarTelaAtual();
            });

            // Hover effect
            star.addEventListener('mouseenter', () => {
                const val = parseInt(star.dataset.value);
                stars.forEach(s => {
                    s.classList.toggle('hover', parseInt(s.dataset.value) <= val);
                });
            });

            star.addEventListener('mouseleave', () => {
                stars.forEach(s => s.classList.remove('hover'));
            });
        });
    });
}

// --- Opções (Sim/Parcialmente/Não) ---
function inicializarOpcoes() {
    document.querySelectorAll('.opcao-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.dataset.name;
            // Desmarcar irmãos
            btn.parentElement.querySelectorAll('.opcao-btn').forEach(b => b.classList.remove('selecionado'));
            btn.classList.add('selecionado');
            state.respostas[name] = btn.dataset.value;

            // Lógica condicional para segurança
            if (name === 'seguranca') {
                const motivo = document.getElementById('motivo-seguranca');
                if (btn.dataset.value === 'Não' || btn.dataset.value === 'Parcialmente') {
                    motivo.style.display = 'block';
                } else {
                    motivo.style.display = 'none';
                }
            }

            validarTelaAtual();
        });
    });
}

// --- NPS ---
function inicializarNPS() {
    document.querySelectorAll('.nps-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const valor = parseInt(btn.dataset.value);
            state.respostas.nps = valor;

            document.querySelectorAll('.nps-btn').forEach(b => b.classList.remove('selecionado'));
            btn.classList.add('selecionado');

            // Lógica NPS
            const detrator = document.getElementById('nps-detrator');
            const promotor = document.getElementById('nps-promotor');

            detrator.style.display = 'none';
            promotor.style.display = 'none';

            if (valor <= 6) {
                detrator.style.display = 'block';
            } else if (valor >= 9) {
                promotor.style.display = 'block';
            }

            validarTela(4);
        });
    });
}

// --- Checkbox "Outro" com input de texto ---
function inicializarCheckOutros() {
    document.querySelectorAll('.check-outro').forEach(check => {
        const inputOutro = check.closest('.check-item').querySelector('.input-outro');
        if (!inputOutro) return;

        check.addEventListener('change', () => {
            inputOutro.disabled = !check.checked;
            if (check.checked) {
                inputOutro.focus();
            } else {
                inputOutro.value = '';
            }
        });
    });
}

// --- Botões de navegação ---
function inicializarBotoes() {
    // Próximo: telas 1-4
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`btn-tela${i}`);
        if (btn) {
            btn.addEventListener('click', () => {
                salvarRascunho();
                enviarEtapaAsync(i);
                navegarPara(i + 1);
            });
        }
    }

    // Enviar pesquisa
    const btnEnviar = document.getElementById('btn-enviar');
    if (btnEnviar) {
        btnEnviar.addEventListener('click', enviarPesquisa);
    }
}

// ===== LÓGICA CONDICIONAL =====
function tratarLogicaCondicional(name, valor) {
    const mapa = {
        'atendimento_recepcao': 'motivo-atendimento',
        'limpeza': 'motivo-limpeza',
        'restaurante': 'motivo-restaurante',
        'servicos': 'motivo-servicos'
    };

    const elementoId = mapa[name];
    if (!elementoId) return;

    const elemento = document.getElementById(elementoId);
    if (valor <= 3) {
        elemento.style.display = 'block';
    } else {
        elemento.style.display = 'none';
        // Limpar checkboxes quando esconde
        elemento.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        elemento.querySelectorAll('.input-outro').forEach(inp => {
            inp.value = '';
            inp.disabled = true;
        });
    }
}

// ===== VALIDAÇÃO =====
function validarTelaAtual() {
    validarTela(state.telaAtual);
}

function validarTela(numTela) {
    const btn = document.getElementById(`btn-tela${numTela}`);
    if (!btn) return;

    let valido = false;

    switch (numTela) {
        case 1:
            valido = state.respostas.regiao && state.respostas.veiculo;
            break;
        case 2:
            valido = state.respostas.atendimento_recepcao && state.respostas.conhece_regras;
            break;
        case 3:
            valido = state.respostas.limpeza && state.respostas.restaurante && state.respostas.servicos;
            break;
        case 4:
            valido = state.respostas.seguranca !== undefined && state.respostas.nps !== undefined;
            break;
    }

    btn.disabled = !valido;
}

// ===== NAVEGAÇÃO =====
function navegarPara(numTela) {
    // Esconder tela atual
    const telaAnterior = document.getElementById(`tela-${state.telaAtual}`);
    if (telaAnterior) {
        telaAnterior.classList.remove('tela-ativa');
    }

    // Mostrar nova tela
    state.telaAtual = numTela;
    const novaTela = document.getElementById(`tela-${numTela}`);
    if (novaTela) {
        novaTela.classList.add('tela-ativa');
    }

    // Atualizar progresso
    atualizarProgresso();

    // Scroll ao topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Validar nova tela
    validarTela(numTela);
}

function atualizarProgresso() {
    const porcentagem = (state.telaAtual / state.totalTelas) * 100;
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');

    if (fill) fill.style.width = porcentagem + '%';
    if (text) text.textContent = `Etapa ${state.telaAtual} de ${state.totalTelas}`;
}

// ===== COLETA DE DADOS =====
function coletarMotivos(containerId) {
    const container = document.getElementById(containerId);
    if (!container || container.style.display === 'none') return [];

    const motivos = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        if (cb.classList.contains('check-outro')) {
            const inputOutro = cb.closest('.check-item').querySelector('.input-outro');
            const textoOutro = inputOutro ? inputOutro.value.trim() : '';
            motivos.push('Outro: ' + textoOutro);
        } else {
            motivos.push(cb.value);
        }
    });
    return motivos;
}

function coletarTodosOsDados() {
    return {
        // Identificação
        regiao: state.respostas.regiao || '',
        veiculo: state.respostas.veiculo || '',

        // Atendimento
        atendimento_recepcao: state.respostas.atendimento_recepcao || null,
        motivos_atendimento: coletarMotivos('motivo-atendimento'),
        conhece_regras: state.respostas.conhece_regras || '',

        // Infraestrutura
        limpeza: state.respostas.limpeza || null,
        motivos_limpeza: coletarMotivos('motivo-limpeza'),
        restaurante: state.respostas.restaurante || null,
        motivos_restaurante: coletarMotivos('motivo-restaurante'),
        servicos: state.respostas.servicos || null,
        motivos_servicos: coletarMotivos('motivo-servicos'),

        // Segurança e NPS
        seguranca: state.respostas.seguranca || '',
        motivos_seguranca: coletarMotivos('motivo-seguranca'),
        nps: state.respostas.nps !== undefined ? state.respostas.nps : null,
        motivo_nps_detrator: document.getElementById('motivo-detrator')?.value.trim() || '',
        motivo_nps_promotor: document.getElementById('motivo-promotor')?.value.trim() || '',

        // Sugestões
        sugestoes: document.getElementById('sugestoes')?.value.trim() || '',

        // Metadata
        timestamp: new Date().toISOString()
    };
}

// ===== ENVIO =====
async function enviarPesquisa() {
    if (state.enviado) return;

    const loading = document.getElementById('loading-overlay');
    loading.style.display = 'flex';

    // Coletar sugestões (tela 5)
    const dados = coletarTodosOsDados();

    try {
        await enviarParaPowerAutomate(dados);
        state.enviado = true;
        registrarEnvio();
        limparRascunho();

        loading.style.display = 'none';

        // Esconder progresso e tela 5
        document.querySelector('.progress-wrapper').style.display = 'none';
        document.getElementById('tela-5').classList.remove('tela-ativa');
        document.getElementById('tela-obrigado').classList.add('tela-ativa');

    } catch (err) {
        // Salvar na fila offline
        adicionarFilaOffline(dados);
        state.enviado = true;
        registrarEnvio();
        limparRascunho();

        loading.style.display = 'none';

        document.querySelector('.progress-wrapper').style.display = 'none';
        document.getElementById('tela-5').classList.remove('tela-ativa');
        document.getElementById('tela-obrigado').classList.add('tela-ativa');
    }
}

async function enviarParaPowerAutomate(dados) {
    if (!CONFIG.POWER_AUTOMATE_URL) {
        console.warn('URL do Power Automate não configurada. Dados salvos localmente.');
        adicionarFilaOffline(dados);
        return;
    }

    const response = await fetch(CONFIG.POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    });

    if (!response.ok) {
        throw new Error('Erro ao enviar: ' + response.status);
    }
}

// Envio assíncrono por etapa (fire-and-forget)
function enviarEtapaAsync(numEtapa) {
    if (!CONFIG.POWER_AUTOMATE_URL) return;

    const dadosParciais = {
        etapa: numEtapa,
        respostas: { ...state.respostas },
        timestamp: new Date().toISOString()
    };

    // Fire and forget - não bloqueia a UI
    fetch(CONFIG.POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosParciais)
    }).catch(() => {
        // Silencioso - o envio final cobrirá
    });
}

// ===== OFFLINE BUFFERING =====
function adicionarFilaOffline(dados) {
    try {
        const fila = JSON.parse(localStorage.getItem(CONFIG.QUEUE_KEY) || '[]');
        fila.push(dados);
        localStorage.setItem(CONFIG.QUEUE_KEY, JSON.stringify(fila));
    } catch (e) {
        console.error('Erro ao salvar na fila offline:', e);
    }
}

function sincronizarFilaOffline() {
    if (!CONFIG.POWER_AUTOMATE_URL) return;

    try {
        const fila = JSON.parse(localStorage.getItem(CONFIG.QUEUE_KEY) || '[]');
        if (fila.length === 0) return;

        const novaFila = [];

        fila.forEach(dados => {
            fetch(CONFIG.POWER_AUTOMATE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            }).then(response => {
                if (!response.ok) {
                    novaFila.push(dados);
                }
                localStorage.setItem(CONFIG.QUEUE_KEY, JSON.stringify(novaFila));
            }).catch(() => {
                novaFila.push(dados);
                localStorage.setItem(CONFIG.QUEUE_KEY, JSON.stringify(novaFila));
            });
        });
    } catch (e) {
        console.error('Erro ao sincronizar fila:', e);
    }
}

// Tentar sincronizar quando a conexão voltar
window.addEventListener('online', sincronizarFilaOffline);

// ===== RASCUNHO (localStorage) =====
function salvarRascunho() {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
            telaAtual: state.telaAtual,
            respostas: state.respostas,
            timestamp: Date.now()
        }));
    } catch (e) {
        // localStorage cheio ou indisponível
    }
}

function carregarRascunho() {
    try {
        const rascunho = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (!rascunho) return;

        const dados = JSON.parse(rascunho);
        // Expira em 2h (sessão do motorista)
        if (Date.now() - dados.timestamp > 2 * 60 * 60 * 1000) {
            limparRascunho();
            return;
        }

        state.respostas = dados.respostas || {};
        restaurarUI();

        if (dados.telaAtual > 1) {
            navegarPara(dados.telaAtual);
        }
    } catch (e) {
        limparRascunho();
    }
}

function limparRascunho() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
}

function restaurarUI() {
    // Região
    if (state.respostas.regiao) {
        document.getElementById('regiao').value = state.respostas.regiao;
    }

    // Veículo
    if (state.respostas.veiculo) {
        document.querySelectorAll('.veiculo-btn').forEach(btn => {
            if (btn.dataset.value === state.respostas.veiculo) {
                btn.classList.add('selecionado');
            }
        });
    }

    // Star ratings
    ['atendimento_recepcao', 'limpeza', 'restaurante', 'servicos'].forEach(name => {
        if (state.respostas[name]) {
            const rating = document.querySelector(`.star-rating[data-name="${name}"]`);
            if (rating) {
                rating.querySelectorAll('.star').forEach(star => {
                    if (parseInt(star.dataset.value) <= state.respostas[name]) {
                        star.classList.add('ativa');
                    }
                });
                tratarLogicaCondicional(name, state.respostas[name]);
            }
        }
    });

    // Opções (Sim/Parcialmente/Não)
    ['conhece_regras', 'seguranca'].forEach(name => {
        if (state.respostas[name]) {
            document.querySelectorAll(`.opcao-btn[data-name="${name}"]`).forEach(btn => {
                if (btn.dataset.value === state.respostas[name]) {
                    btn.classList.add('selecionado');
                }
            });

            if (name === 'seguranca') {
                const val = state.respostas[name];
                if (val === 'Não' || val === 'Parcialmente') {
                    document.getElementById('motivo-seguranca').style.display = 'block';
                }
            }
        }
    });

    // NPS
    if (state.respostas.nps !== undefined) {
        document.querySelectorAll('.nps-btn').forEach(btn => {
            if (parseInt(btn.dataset.value) === state.respostas.nps) {
                btn.classList.add('selecionado');
            }
        });
        if (state.respostas.nps <= 6) {
            document.getElementById('nps-detrator').style.display = 'block';
        } else if (state.respostas.nps >= 9) {
            document.getElementById('nps-promotor').style.display = 'block';
        }
    }

    // Revalidar todas as telas
    for (let i = 1; i <= 4; i++) {
        validarTela(i);
    }
}
