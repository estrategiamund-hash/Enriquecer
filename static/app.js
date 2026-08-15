const state = {
  currentRecord: null,
  selectedFields: [],
  selectedQueryFields: new Set(),
  queue: [],
  notifications: [],
  currentRole: document.body.dataset.userRole || 'user1',
  activeRequestImportId: null,
  currentAction: 'enrich_only',
  historyCurrentPage: 1,
  historyItemsPerPage: 20,
};

const expandedCardIds = new Set();

function downloadFileDirectly(url) {
  const link = document.createElement('a');
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const tabButtons = document.querySelectorAll('.tab');
const roleSelector = document.getElementById('roleSwitcher');
const panels = {
  'user-panel': document.getElementById('user-panel'),
  'strategy-panel': document.getElementById('strategy-panel'),
  'logs-panel': document.getElementById('logs-panel'),
};

const uploadForm = document.getElementById('uploadForm');
const validationMessage = document.getElementById('validationMessage');
const previewCard = document.getElementById('previewCard');
const previewText = document.getElementById('previewText');
const availableFields = document.getElementById('availableFields');
const selectedFields = document.getElementById('selectedFields');
const finalizeButton = document.getElementById('finalizeButton');

// Step selectors
const step1Container = document.getElementById('step1Container');
const step2Container = document.getElementById('step2Container');
const step3Container = document.getElementById('step3Container');
const enrichButton = document.getElementById('enrichButton');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');
const uploadLogsBox = document.getElementById('uploadLogsBox');
const requestModal = document.getElementById('requestModal');
const requestForm = document.getElementById('requestForm');
const queueList = document.getElementById('strategyQueue');
const strategyNotifications = document.getElementById('strategyNotifications');
const userNotifications = document.getElementById('userNotifications');
const logsList = document.getElementById('logsQueue');
const logsModal = document.getElementById('logsModal');
const logsModalTitle = document.getElementById('logsModalTitle');
const logsModalContent = document.getElementById('logsModalContent');
const logCounterTotal = document.getElementById('logCounterTotal');
const logCounterSuccess = document.getElementById('logCounterSuccess');
const logCounterError = document.getElementById('logCounterError');

// Queue active/history elements
const strategyQueueActive = document.getElementById('strategyQueueActive');
const strategyQueueHistoryQueue = document.getElementById('strategyQueueHistoryQueue');
const strategyQueueHistoryEnrich = document.getElementById('strategyQueueHistoryEnrich');
const activeBadge = document.getElementById('activeBadge');
const historyQueueBadge = document.getElementById('historyQueueBadge');
const historyEnrichBadge = document.getElementById('historyEnrichBadge');

// Usability selectors
const dropZone = document.getElementById('dropZone');
const validationWarningBox = document.getElementById('validationWarningBox');
const validationWarningText = document.getElementById('validationWarningText');
const btnProceedValidation = document.getElementById('btnProceedValidation');
const btnCancelValidation = document.getElementById('btnCancelValidation');
const errorDetailsList = document.getElementById('errorDetailsList');

const statProcessed = document.getElementById('statProcessed');
const statSuccess = document.getElementById('statSuccess');
const statError = document.getElementById('statError');
const statTimeRemaining = document.getElementById('statTimeRemaining');

const REQUIRED_FIELDS = ['nome', 'telefone'];

function labelize(value) {
  if (!value) return 'Campo';
  const clean = value.replace(/_/g, ' ');
  if (clean.toLowerCase() === 'cpf') return 'CPF';
  if (clean.toLowerCase() === 'cbo') return 'CBO';
  if (clean.toLowerCase() === 'uf') return 'UF';
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const content = document.createElement('span');
  content.className = 'toast-content';
  content.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => {
    toast.classList.add('toast-fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  };

  toast.appendChild(content);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  // Web Notification API integration (popup notifications when out of tab)
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Nova Vida Enriquecimento', {
        body: message,
        icon: '/static/Bookplay.png.webp'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Nova Vida Enriquecimento', {
            body: message,
            icon: '/static/Bookplay.png.webp'
          });
        }
      });
    }
  }

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('toast-fade-out');
      toast.addEventListener('animationend', () => toast.remove());
    }
  }, 4000);
}

function showMessage(text, type = 'success') {
  validationMessage.textContent = text;
  validationMessage.className = `message ${type}`;
  validationMessage.classList.remove('hidden');
  showToast(text, type);
}

function hideMessage() {
  validationMessage.classList.add('hidden');
}

function formatSelectedFields(fields) {
  const nomeLabel = labelize('nome').toUpperCase();
  const telLabel = labelize('telefone').toUpperCase();

  let result = `${nomeLabel}|${telLabel}|`;

  const remaining = fields.filter((f) => f !== 'nome' && f !== 'telefone');
  if (remaining.length > 0) {
    result += ' ' + remaining.map((f) => labelize(f)).join(' ');
  }
  return result;
}

function formatPreviewFields(fields, previewData) {
  if (!previewData) previewData = {};
  const nomeVal = previewData['nome'] || previewData['nome_completo'] || previewData['NOME'] || '—';
  const telVal = previewData['telefone'] || previewData['celular'] || previewData['TELEFONE'] || '—';

  let result = `${nomeVal} | ${telVal}`;

  const remaining = fields.filter((f) => f !== 'nome' && f !== 'telefone');
  if (remaining.length > 0) {
    const parts = remaining.map((field) => {
      const val = (previewData[field] !== undefined && previewData[field] !== null && String(previewData[field]).trim() !== '') 
        ? previewData[field] 
        : '—';
      return `${labelize(field)}: ${val}`;
    });
    result += ' | ' + parts.join(' | ');
  }
  return result;
}

function applyRoleAccess() {
  const roleSelector = document.getElementById('roleSwitcher');
  const userRole = document.body.dataset.userRole;

  if (roleSelector) {
    roleSelector.value = state.currentRole;
    roleSelector.disabled = userRole !== 'admin';
  }

  if (userRole !== 'admin') {
    state.currentRole = 'user1';
  }

  // Switch active panel based on the selected role/tab value
  if (state.currentRole === 'admin') {
    setActiveTab('strategy-panel');
  } else if (state.currentRole === 'admin-user' || state.currentRole === 'user1') {
    setActiveTab('user-panel');
  } else if (state.currentRole === 'admin-logs') {
    setActiveTab('logs-panel');
  }
}

function setActiveTab(targetId) {
  tabButtons.forEach((button) => {
    const shouldBeActive = button.dataset.target === targetId;
    button.classList.toggle('is-active', shouldBeActive);
  });

  Object.entries(panels).forEach(([key, panel]) => {
    if (panel) {
      panel.classList.toggle('hidden', key !== targetId);
      panel.classList.toggle('is-visible', key === targetId);
    }
  });

  if (targetId === 'logs-panel') {
    loadLogsQueue();
  }
}

function renderAvailableFields() {
  if (!state.currentRecord) {
    availableFields.innerHTML = '';
    return;
  }

  const used = new Set(state.selectedFields);
  const fields = state.currentAction === 'queue_only'
    ? (state.currentRecord.columns || [])
    : (state.currentRecord.available_fields || []);
  const items = fields.filter((field) => !used.has(field));

  availableFields.innerHTML = '';
  items.forEach((field) => {
    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = 'field-tag';
    tag.draggable = true;
    tag.dataset.field = field;
    tag.textContent = labelize(field);
    tag.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', field);
      event.dataTransfer.effectAllowed = 'copy';
    });
    tag.addEventListener('click', () => addField(field));
    availableFields.appendChild(tag);
  });

  availableFields.addEventListener('dragover', (event) => event.preventDefault());
  availableFields.addEventListener('drop', (event) => {
    event.preventDefault();
    const field = event.dataTransfer.getData('text/plain');
    if (field) {
      removeField(field);
    }
  });
}

function renderSelectedFields() {
  if (!state.currentRecord) {
    selectedFields.innerHTML = '';
    return;
  }

  selectedFields.innerHTML = '';
  state.selectedFields.forEach((field) => {
    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = `field-tag ${REQUIRED_FIELDS.includes(field) ? 'required' : ''}`;
    tag.draggable = true;
    tag.dataset.field = field;
    tag.textContent = labelize(field);
    tag.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', field);
      event.dataTransfer.effectAllowed = 'move';
    });
    tag.addEventListener('click', () => removeField(field));
    selectedFields.appendChild(tag);
  });

  selectedFields.addEventListener('dragover', (event) => event.preventDefault());
  selectedFields.addEventListener('drop', (event) => {
    event.preventDefault();
    const field = event.dataTransfer.getData('text/plain');
    if (field) {
      addField(field);
    }
  });
}

function addField(field) {
  if (!state.currentRecord) return;
  const isAlreadySelected = state.selectedFields.includes(field);
  if (isAlreadySelected) return;
  if (field === 'tipo_enriquecimento') return;

  const orderedFields = [...state.selectedFields, field];
  const uniqueFields = [...new Set(orderedFields)];
  state.selectedFields = uniqueFields;
  renderAvailableFields();
  renderSelectedFields();
  renderPreview();
}

function removeField(field) {
  if (!state.currentRecord) return;
  if (REQUIRED_FIELDS.includes(field)) return;
  state.selectedFields = state.selectedFields.filter((item) => item !== field);
  renderAvailableFields();
  renderSelectedFields();
  renderPreview();
}

function renderPreview() {
  if (!state.currentRecord) {
    previewCard.classList.add('hidden');
    return;
  }

  const previewData = state.currentRecord.preview || {};
  const selected = state.selectedFields;

  if (!selected.length) {
    previewText.textContent = 'Selecione os campos para visualizar a prévia.';
    previewCard.classList.remove('hidden');
    return;
  }

  previewText.textContent = formatPreviewFields(selected, previewData);
  previewCard.classList.remove('hidden');
}

function updateRequestButtonState() {
  // Finalize button is always visible in Step 3
}

function setActionMode(mode) {
  state.currentAction = mode;
  document.querySelectorAll('.mode-btn').forEach((button) => {
    const isSelected = button.dataset.actionType === mode;
    button.classList.toggle('is-active', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });

  if (uploadForm) {
    uploadForm.classList.remove('hidden');
  }
  if (step1Container) {
    step1Container.classList.add('hidden');
  }
  if (step2Container) {
    step2Container.classList.add('hidden');
  }
  if (step3Container) {
    step3Container.classList.add('hidden');
  }
}

async function handleUpload(event) {
  event.preventDefault();
  const file = document.getElementById('excelFile').files[0];
  if (!file) {
    showMessage('Selecione uma planilha primeiro.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const submitButton = uploadForm.querySelector("button[type='submit']");

  // Show loading state
  if (dropZone) {
    dropZone.classList.add('drop-zone--loading');
    let spinner = dropZone.querySelector('.drop-zone-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.className = 'drop-zone-spinner';
      dropZone.insertBefore(spinner, dropZone.firstChild);
    }
    const textEl = dropZone.querySelector('.drop-zone-text');
    if (textEl) {
      textEl.dataset.originalText = textEl.textContent;
      textEl.textContent = 'Carregando e validando planilha...';
    }
  }
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Aguarde...';
  }

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Arquivo inválido.');
    }

    state.currentRecord = payload;

    const selected = [];
    if (state.currentAction === 'queue_only') {
      selected.push(...(payload.columns || []));
    } else {
      const initial = [...REQUIRED_FIELDS].filter((field) => (payload.available_fields || []).includes(field));
      selected.push(...initial);
      if (payload.columns) {
        payload.columns.forEach((col) => {
          if (!selected.includes(col) && (payload.available_fields || []).includes(col)) {
            selected.push(col);
          }
        });
      }
    }

    state.selectedFields = selected;

    if (state.currentAction !== 'queue_only' && state.selectedFields.length < REQUIRED_FIELDS.length) {
      const missing = REQUIRED_FIELDS.filter((field) => !state.selectedFields.includes(field));
      showMessage(`Faltam campos obrigatórios: ${missing.join(', ')}`, 'error');
    } else {
      hideMessage();
      showMessage(`Arquivo validado: ${payload.detected_type}.`, 'success');
    }

    // Hide old panels
    step2Container.classList.add('hidden');
    step3Container.classList.add('hidden');

    if (payload.invalid_phone_count && payload.invalid_phone_count > 0) {
      validationWarningText.textContent = `Identificamos ${payload.invalid_phone_count} contatos com telefones sem DDD ou formato inválido na sua planilha. Veja os detalhes abaixo:`;

      if (errorDetailsList) {
        errorDetailsList.innerHTML = '';
        (payload.invalid_phones || []).forEach((item) => {
          const div = document.createElement('div');
          div.className = 'error-item';
          div.innerHTML = `
            <span class="error-item-loc">Linha ${item.row}</span>
            <span class="error-item-info">${item.name} (${item.phone})</span>
            <span class="error-item-reason">${item.reason}</span>
          `;
          errorDetailsList.appendChild(div);
        });
      }

      validationWarningBox.classList.remove('hidden');
      step1Container.classList.add('hidden');
    } else {
      validationWarningBox.classList.add('hidden');
      if (state.currentAction === 'queue_only') {
        step3Container.classList.remove('hidden');
        renderAvailableFields();
        renderSelectedFields();
        renderPreview();
      } else {
        step1Container.classList.remove('hidden');
      }
    }

    renderQueryFieldsSelection(payload.columns || []);
  } catch (error) {
    state.currentRecord = null;
    state.selectedFields = [];
    const mappingPanel = document.querySelector('.mapping-panel');
    if (mappingPanel) mappingPanel.classList.add('hidden');
    previewCard.classList.add('hidden');

    // Reset drop-zone text and borders
    if (uploadForm) uploadForm.reset();
    if (dropZone) {
      dropZone.classList.remove('drop-zone--attached');
      const textEl = dropZone.querySelector('.drop-zone-text');
      if (textEl) {
        textEl.textContent = 'Arrastar e soltar arquivo aqui (.xlsx, .csv) ou clique para selecionar';
        textEl.dataset.originalText = textEl.textContent;
      }
    }
    showMessage(error.message, 'error');
  } finally {
    // Restore state
    if (dropZone) {
      dropZone.classList.remove('drop-zone--loading');
      const textEl = dropZone.querySelector('.drop-zone-text');
      if (textEl && textEl.dataset.originalText) {
        textEl.textContent = textEl.dataset.originalText;
      }
    }
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Validar arquivo';
    }
  }
}

function openRequestModal() {
  if (!state.currentRecord || !state.selectedFields.length) {
    showMessage('Selecione nome e telefone para criar a solicitação.', 'error');
    return;
  }

  requestModal.classList.remove('hidden');
}

function closeRequestModal() {
  requestModal.classList.add('hidden');
  requestForm.reset();
}

async function submitRequest(event) {
  event.preventDefault();

  const queueNumber = document.getElementById('queueNumber').value.trim();
  const requesterName = document.getElementById('requesterName').value.trim();
  const observacoes = document.getElementById('observacoes').value.trim();

  if (!/^\d{6}$/.test(queueNumber)) {
    showMessage('O número da fila deve conter 6 dígitos.', 'error');
    return;
  }

  if (!requesterName) {
    showMessage('O nome do solicitante é obrigatório.', 'error');
    return;
  }

  let requestId = state.activeRequestImportId;
  if (!requestId) {
    try {
      const response = await fetch('/api/request-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: state.currentRecord?.id,
          query_fields: Array.from(state.selectedQueryFields || []),
          mode: 'queue_only'
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível criar a fila.');
      }
      requestId = payload.request_id;
      state.activeRequestImportId = requestId;
    } catch (error) {
      showMessage(error.message, 'error');
      return;
    }
  }

  try {
    const response = await fetch(`/api/request/${requestId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queue_number: queueNumber,
        requester_name: requesterName,
        observacoes,
        selected_fields: state.selectedFields,
        mode: state.currentAction || 'queue_only',
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Não foi possível enviar a solicitação.');
    }

    closeRequestModal();
    step3Container.classList.add('hidden');
    showMessage(payload.message, 'success');
    loadQueue();
    loadLogsQueue();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function loadQueue() {
  try {
    const response = await fetch('/api/queue');
    if (!response.ok) {
      throw new Error('Não foi possível carregar a fila.');
    }

    const payload = await response.json();
    state.queue = payload.queue || [];
    if (state.currentRole === 'admin') {
      renderQueue();
    } else {
      renderNormalUserHistory();
    }
  } catch (error) {
    console.error(error);
  }
}

function renderNormalUserHistory() {
  const container = document.getElementById('normalUserHistoryQueue');
  if (!container) return;

  // Filter completed requests that have a summary image (strategist uploaded devolutiva), OR rejected requests
  const items = state.queue.filter(item => 
    (item.status === 'completed' && item.summary_name) || 
    item.status === 'rejected'
  );

  if (!items.length) {
    container.innerHTML = '<div class="queue-item"><strong>Nenhum histórico disponível no momento.</strong></div>';
    return;
  }

  container.innerHTML = '';
  items.forEach((item) => {
    const row = document.createElement('article');
    const isCollapsed = !expandedCardIds.has(item.id);
    row.className = `queue-item ${isCollapsed ? 'collapsed' : ''}`;
    const rotation = isCollapsed ? '0deg' : '-180deg';
    
    let actionBtnHtml = '';
    if (item.status === 'rejected') {
      const reason = getItemRejectReason(item);
      actionBtnHtml = `<button type="button" class="button secondary" style="background-color: var(--danger-color); color: white; border-color: var(--danger-color); padding: 0.4rem 1rem; border-radius: var(--radius-sm); font-size: 0.8rem;" onclick="openViewReasonModal('${encodeURIComponent(reason)}')">Motivo da Recusa</button>`;
    } else {
      actionBtnHtml = `<button type="button" class="primary" style="padding: 0.4rem 1rem; border-radius: var(--radius-sm); font-size: 0.8rem;" onclick="openImageViewer('/api/summary/${item.id}')">Visualizar Devolutiva</button>`;
    }

    row.innerHTML = `
      <div class="queue-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="collapse-icon" style="display: inline-block; transition: transform 0.2s; font-size: 0.8rem; color: var(--text-muted); transform: rotate(${rotation});">▼</span>
          <strong>Fila ${item.queue_number || 'Sem Fila'}</strong>
        </div>
        <span class="badge ${item.status === 'rejected' ? 'error' : 'completed'}">
          ${item.status === 'rejected' ? 'Recusado' : 'Importado'}
        </span>
      </div>
      <div class="queue-collapsible-content">
        <div class="queue-meta">Solicitante: ${item.requester_name}</div>
        <div class="queue-meta">Horário Conclusão: ${item.completed_at || item.request_time}</div>
        <div class="queue-actions" style="margin-top: 0.5rem;">
          ${actionBtnHtml}
        </div>
      </div>
    `;

    const header = row.querySelector('.queue-header');
    header.addEventListener('click', () => {
      row.classList.toggle('collapsed');
      const icon = header.querySelector('.collapse-icon');
      if (row.classList.contains('collapsed')) {
        icon.style.transform = 'rotate(0deg)';
        expandedCardIds.delete(item.id);
      } else {
        icon.style.transform = 'rotate(-180deg)';
        expandedCardIds.add(item.id);
      }
    });

    container.appendChild(row);
  });
}

let currentZoom = 1;
let isPanning = false;
let startX = 0;
let startY = 0;
let translateX = 0;
let translateY = 0;

function openImageViewer(src) {
  const modal = document.getElementById('imageViewerModal');
  const img = document.getElementById('viewerImage');
  if (modal && img) {
    img.src = src;
    currentZoom = 1;
    translateX = 0;
    translateY = 0;
    img.style.transform = `scale(${currentZoom}) translate(0px, 0px)`;
    img.style.cursor = 'grab';
    modal.classList.remove('hidden');
  }
}

function closeImageViewer() {
  const modal = document.getElementById('imageViewerModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function zoomImage(amount) {
  const img = document.getElementById('viewerImage');
  if (img) {
    currentZoom = Math.max(0.5, Math.min(3, currentZoom + amount));
    img.style.transform = `scale(${currentZoom})`;
  }
}

function resetZoom() {
  const img = document.getElementById('viewerImage');
  if (img) {
    currentZoom = 1;
    img.style.transform = `scale(${currentZoom})`;
  }
}

window.openImageViewer = openImageViewer;
window.closeImageViewer = closeImageViewer;
window.zoomImage = zoomImage;
window.resetZoom = resetZoom;

function renderQueueActive() {
  // Filtrar apenas itens ativos (não completados), excluindo 'enrich_only'
  const activeItems = state.queue.filter(item => 
    item.status !== 'completed' && 
    item.status !== 'rejected' && 
    item.mode !== 'enrich_only'
  );
  
  if (!activeItems.length) {
    strategyQueueActive.innerHTML = '<div class="queue-item"><strong>Sem solicitações ativas no momento.</strong></div>';
    activeBadge.textContent = '0';
    return;
  }

  activeBadge.textContent = activeItems.length;
  strategyQueueActive.innerHTML = '';
  activeItems.forEach((item) => {
    const row = document.createElement('article');
    const isCollapsed = !expandedCardIds.has(item.id);
    row.className = `queue-item ${isCollapsed ? 'collapsed' : ''}`;
    const rotation = isCollapsed ? '0deg' : '-180deg';
    const formattedFields = formatSelectedFields(item.selected_fields || []);
    
    // Verificar se está aguardando confirmação (queue_number === "TEMP")
    const isAwaitingConfirmation = item.queue_number === "TEMP";
    let queueNumberDisplay = item.queue_number;
    if (isAwaitingConfirmation) {
      queueNumberDisplay = "TEMP (Aguardando dados)";
    }

    let actionsHtml = '';
    let statusText = 'Pendente';
    let badgeClass = 'pending';

    if (item.status === 'processing') {
      const pct = item.total_rows > 0 ? Math.round((item.processed_count / item.total_rows) * 100) : 0;
      statusText = `Processando (${pct}%)`;
      badgeClass = 'processing';
    } else if (item.status === 'error') {
      statusText = 'Erro';
      badgeClass = 'error';
    } else if (item.status === 'rejected') {
      statusText = 'Recusado';
      badgeClass = 'error';
    }

    const isEnrichOnly = item.queue_number === "ENRICH";
    
    let refuseBtnHtml = '';
    if (item.status === 'pending' || item.status === 'processing') {
      refuseBtnHtml = `<button type="button" class="button secondary" onclick="openRefuseModal('${item.id}')" style="background-color: var(--danger-color); color: white; border-color: var(--danger-color); font-size: 0.8rem; padding: 0.4rem 1rem; border-radius: var(--radius-sm);">Recusar</button>`;
    }

    if (item.queue_number !== "TEMP") {
      if (isEnrichOnly) {
        actionsHtml = `
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${refuseBtnHtml}
            <button type="button" class="download-link-premium" style="display: inline-flex; align-items: center; gap: 8px; border: none; font-family: inherit;" onclick="downloadFileDirectly('/api/request/${item.id}/download')" title="Baixar Planilha">
              <svg viewBox="0 0 256 256" height="24" width="28" xmlns="http://www.w3.org/2000/svg">
                <path d="M74.34 85.66a8 8 0 0 1 11.32-11.32L120 108.69V24a8 8 0 0 1 16 0v84.69l34.34-34.35a8 8 0 0 1 11.32 11.32l-48 48a8 8 0 0 1-11.32 0ZM240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h52.4a4 4 0 0 1 2.83 1.17L111 145a24 24 0 0 0 34 0l23.8-23.8a4 4 0 0 1 2.8-1.2H224a16 16 0 0 1 16 16m-40 32a12 12 0 1 0-12 12a12 12 0 0 0 12-12" fill="currentColor"></path>
              </svg>
              <span>Download</span>
            </button>
          </div>
        `;
      } else {
        actionsHtml = `
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${refuseBtnHtml}
            <button type="button" class="download-link-premium" style="display: inline-flex; align-items: center; gap: 8px; border: none; font-family: inherit;" onclick="downloadFileDirectly('/api/request/${item.id}/download')" title="Baixar Planilha">
              <svg viewBox="0 0 256 256" height="24" width="28" xmlns="http://www.w3.org/2000/svg">
                <path d="M74.34 85.66a8 8 0 0 1 11.32-11.32L120 108.69V24a8 8 0 0 1 16 0v84.69l34.34-34.35a8 8 0 0 1 11.32 11.32l-48 48a8 8 0 0 1-11.32 0ZM240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h52.4a4 4 0 0 1 2.83 1.17L111 145a24 24 0 0 0 34 0l23.8-23.8a4 4 0 0 1 2.8-1.2H224a16 16 0 0 1 16 16m-40 32a12 12 0 1 0-12 12a12 12 0 0 0 12-12" fill="currentColor"></path>
              </svg>
              <span>Download</span>
            </button>
            <input type="file" accept="image/*" class="summary-upload" data-id="${item.id}" />
            <button type="button" class="primary" data-submit-summary="${item.id}">Check</button>
          </div>
        `;
      }
    } else {
      actionsHtml = `<span class="badge pending">Aguardando dados da fila</span>`;
    }
    
    let rejectReasonHtml = '';
    if (item.status === 'rejected' && item.reject_reason) {
      rejectReasonHtml = `<div class="queue-meta" style="color: var(--danger-color);"><strong>Motivo da Recusa:</strong> ${item.reject_reason}</div>`;
    }

    row.innerHTML = `
      <div class="queue-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="collapse-icon" style="display: inline-block; transition: transform 0.2s; font-size: 0.8rem; color: var(--text-muted); transform: rotate(${rotation});">▼</span>
          <strong>Fila ${queueNumberDisplay}</strong>
        </div>
        <span class="badge ${badgeClass}">${statusText}</span>
      </div>
      <div class="queue-collapsible-content">
        <div class="queue-meta">Solicitante: ${item.requester_name}</div>
        <div class="queue-meta">Horário: ${item.request_time}</div>
        <div class="queue-meta">Campos: ${formattedFields}</div>
        ${rejectReasonHtml}
        <div class="queue-actions">
          ${actionsHtml}
          <button type="button" class="button secondary" onclick="viewDetailedLogs('${item.id}')">Logs</button>
        </div>
      </div>
    `;

    // Add collapse toggle handler
    const header = row.querySelector('.queue-header');
    header.addEventListener('click', (e) => {
      row.classList.toggle('collapsed');
      const icon = header.querySelector('.collapse-icon');
      if (row.classList.contains('collapsed')) {
        icon.style.transform = 'rotate(0deg)';
        expandedCardIds.delete(item.id);
      } else {
        icon.style.transform = 'rotate(-180deg)';
        expandedCardIds.add(item.id);
      }
    });

    strategyQueueActive.appendChild(row);
  });
}

function renderQueue() {
  renderQueueActive();
  renderQueueHistoryQueue();
  renderQueueHistoryEnrich();
}

function renderQueueHistoryQueue() {
  if (!strategyQueueHistoryQueue) return;
  const historyItems = state.queue.filter(item => 
    (item.status === 'completed' || item.status === 'rejected') &&
    item.queue_number !== "ENRICH" &&
    item.mode !== "enrich_only"
  );
  
  if (!historyItems.length) {
    strategyQueueHistoryQueue.innerHTML = '<div class="queue-item"><strong>Nenhum histórico de fila disponível.</strong></div>';
    if (historyQueueBadge) historyQueueBadge.textContent = '0';
    return;
  }

  if (historyQueueBadge) historyQueueBadge.textContent = historyItems.length;
  
  const sortedItems = historyItems.sort((a, b) => parseDate(b.completed_at || b.request_time) - parseDate(a.completed_at || a.request_time));
  strategyQueueHistoryQueue.innerHTML = '';
  
  sortedItems.forEach((item) => {
    const row = createHistoryRowElement(item);
    strategyQueueHistoryQueue.appendChild(row);
  });
}

function renderQueueHistoryEnrich() {
  if (!strategyQueueHistoryEnrich) return;
  const historyItems = state.queue.filter(item => 
    (item.status === 'completed' || item.status === 'rejected') &&
    (item.queue_number === "ENRICH" || item.mode === "enrich_only")
  );
  
  if (!historyItems.length) {
    strategyQueueHistoryEnrich.innerHTML = '<div class="queue-item"><strong>Nenhum histórico de enriquecimento direto disponível.</strong></div>';
    if (historyEnrichBadge) historyEnrichBadge.textContent = '0';
    return;
  }

  if (historyEnrichBadge) historyEnrichBadge.textContent = historyItems.length;
  
  const sortedItems = historyItems.sort((a, b) => parseDate(b.completed_at || b.request_time) - parseDate(a.completed_at || a.request_time));
  strategyQueueHistoryEnrich.innerHTML = '';
  
  sortedItems.forEach((item) => {
    const row = createHistoryRowElement(item);
    strategyQueueHistoryEnrich.appendChild(row);
  });
}

function createHistoryRowElement(item) {
  const row = document.createElement('article');
  const isCollapsed = !expandedCardIds.has(item.id);
  row.className = `queue-item ${isCollapsed ? 'collapsed' : ''}`;
  const rotation = isCollapsed ? '0deg' : '-180deg';
  const formattedFields = formatSelectedFields(item.selected_fields || []);
  const isEnrichOnly = item.queue_number === "ENRICH" || item.mode === "enrich_only";
  const devolutivaBtnHtml = item.summary_name
    ? `<button type="button" class="primary" style="padding: 0.4rem 1rem; border-radius: var(--radius-sm); font-size: 0.8rem;" onclick="openImageViewer('/api/summary/${item.id}')">Visualizar Devolutiva</button>`
    : '';

  row.innerHTML = `
    <div class="queue-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span class="collapse-icon" style="display: inline-block; transition: transform 0.2s; font-size: 0.8rem; color: var(--text-muted); transform: rotate(${rotation});">▼</span>
        <strong>${isEnrichOnly ? 'Enriquecimento Direto' : 'Fila ' + item.queue_number}</strong>
      </div>
      <span class="badge ${item.status === 'rejected' ? 'error' : 'completed'}">
        ${item.status === 'rejected' ? 'Recusado' : (isEnrichOnly ? 'Enriquecido' : 'Concluído')}
      </span>
    </div>
    <div class="queue-collapsible-content">
      <div class="queue-meta">Solicitante: ${item.requester_name}</div>
      <div class="queue-meta">Horário: ${item.completed_at || item.request_time}</div>
      <div class="queue-meta">Campos: ${formattedFields}</div>
      <div class="queue-actions">
        <span class="badge ${item.status === 'rejected' ? 'error' : 'completed'}">
          ${item.status === 'rejected' ? 'Recusado' : (isEnrichOnly ? 'Apenas Enriquecido' : 'Importado com sucesso')}
        </span>
        <button type="button" class="download-link-premium" style="display: inline-flex; align-items: center; gap: 8px; border: none; font-family: inherit;" onclick="downloadFileDirectly('/api/request/${item.id}/download')" title="Baixar Planilha">
          <svg viewBox="0 0 256 256" height="24" width="28" xmlns="http://www.w3.org/2000/svg">
            <path d="M74.34 85.66a8 8 0 0 1 11.32-11.32L120 108.69V24a8 8 0 0 1 16 0v84.69l34.34-34.35a8 8 0 0 1 11.32 11.32l-48 48a8 8 0 0 1-11.32 0ZM240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h52.4a4 4 0 0 1 2.83 1.17L111 145a24 24 0 0 0 34 0l23.8-23.8a4 4 0 0 1 2.8-1.2H224a16 16 0 0 1 16 16m-40 32a12 12 0 1 0-12 12a12 12 0 0 0 12-12" fill="currentColor"></path>
          </svg>
          <span>Download</span>
        </button>
        ${item.status === 'rejected' ? `<button type="button" class="button secondary" style="background-color: var(--danger-color); color: white; border-color: var(--danger-color);" onclick="openViewReasonModal('${encodeURIComponent(getItemRejectReason(item))}')">Motivo da Recusa</button>` : ''}
        ${devolutivaBtnHtml}
        <button type="button" class="button secondary" onclick="viewDetailedLogs('${item.id}')">Logs</button>
      </div>
    </div>
  `;

  const header = row.querySelector('.queue-header');
  header.addEventListener('click', () => {
    row.classList.toggle('collapsed');
    const icon = header.querySelector('.collapse-icon');
    if (row.classList.contains('collapsed')) {
      icon.style.transform = 'rotate(0deg)';
      expandedCardIds.delete(item.id);
    } else {
      icon.style.transform = 'rotate(-180deg)';
      expandedCardIds.add(item.id);
    }
  });

  return row;
}

function parseDate(dateStr) {
  // Esperado formato: "DD/MM/YYYY HH:MM:SS"
  if (!dateStr) return new Date(0);
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hour, minute, second] = timePart ? timePart.split(':') : ['0', '0', '0'];
    return new Date(year, month - 1, day, hour, minute, second);
  } catch (e) {
    return new Date(0);
  }
}

function goToHistoryPage(page) {
  state.historyCurrentPage = page;
  renderQueue();
}

function renderQueue() {
  renderQueueActive();
  renderQueueHistoryQueue();
  renderQueueHistoryEnrich();
}

async function submitSummary(event) {
  const button = event.target.closest('[data-submit-summary]');
  if (!button) return;

  const requestId = button.dataset.submitSummary;
  const fileInput = document.querySelector(`.summary-upload[data-id='${requestId}']`);

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showMessage('Anexe uma imagem do resumo antes de concluir.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('summaryImage', fileInput.files[0]);

  try {
    const response = await fetch(`/api/request/${requestId}/complete`, {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Não foi possível concluir a importação.');
    }

    showMessage(payload.message, 'success');
    await loadNotifications();
    await loadQueue();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function loadNotifications() {
  try {
    const response = await fetch('/api/notifications');
    if (!response.ok) {
      throw new Error('Não foi possível carregar as notificações.');
    }

    const payload = await response.json();
    state.notifications = payload.notifications || [];

    const renderBlock = (target, emptyText) => {
      target.innerHTML = '';
      if (!state.notifications.length) {
        target.innerHTML = `<div class="notification-item"><p>${emptyText}</p></div>`;
        return;
      }

      state.notifications.forEach((notification) => {
        const item = document.createElement('div');
        item.className = 'notification-item';
        item.innerHTML = `<p><strong>${notification.title}</strong> — ${notification.message}</p><div class="queue-meta">${notification.time}</div>`;
        target.appendChild(item);
      });
    };

    renderBlock(strategyNotifications, 'Nenhuma notificação para estratégia no momento.');
    renderBlock(userNotifications, '');
  } catch (error) {
    console.error(error);
  }
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.target));
});

if (roleSelector) {
  roleSelector.addEventListener('change', (event) => {
    state.currentRole = event.target.value;
    applyRoleAccess();
  });
}

// Setup user tabs
const userTabButtons = document.querySelectorAll('[data-user-tab]');
const userImportSection = document.getElementById('user-import-section');
const normalUserHistoryContainer = document.getElementById('normalUserHistoryContainer');

if (userTabButtons.length > 0) {
  userTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      userTabButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const tabName = btn.getAttribute('data-user-tab');
      if (tabName === 'import') {
        if(userImportSection) userImportSection.classList.remove('hidden');
        if(normalUserHistoryContainer) normalUserHistoryContainer.classList.add('hidden');
      } else if (tabName === 'history') {
        if(userImportSection) userImportSection.classList.add('hidden');
        if(normalUserHistoryContainer) normalUserHistoryContainer.classList.remove('hidden');
        renderNormalUserHistory(); // refresh the view
      }
    });
  });
}

document.querySelectorAll('.mode-btn').forEach((button) => {
  button.addEventListener('click', () => setActionMode(button.dataset.actionType));
});

setActionMode(state.currentAction);

async function handleFinalizeButton() {
  if (state.currentAction === 'enrich_only') {
    if (!state.activeRequestImportId) {
      showMessage('Nenhum arquivo enriquecido pronto para download.', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/request/${state.activeRequestImportId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_fields: state.selectedFields,
          mode: 'enrich_only',
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Não foi possível finalizar o enriquecimento.');
      }

      downloadFileDirectly(`/api/request/${state.activeRequestImportId}/download`);
      showMessage(payload.message, 'success');
      return;
    } catch (error) {
      showMessage(error.message, 'error');
      return;
    }
  }

  openRequestModal();
}

function openRequesterModal() {
  const modal = document.getElementById('requesterModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('requesterInputName').focus();
  }
}

function closeRequesterModal() {
  const modal = document.getElementById('requesterModal');
  if (modal) {
    modal.classList.add('hidden');
    document.getElementById('requesterForm').reset();
  }
}

const requesterForm = document.getElementById('requesterForm');
if (requesterForm) {
  requesterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const requesterName = document.getElementById('requesterInputName').value.trim();
    if (!requesterName) return;
    closeRequesterModal();
    startEnrichment(requesterName);
  });
}

// Expose modal handlers globally for inline onclick
window.closeRequesterModal = closeRequesterModal;

let activeRefuseRequestId = null;

function openRefuseModal(requestId) {
  activeRefuseRequestId = requestId;
  const modal = document.getElementById('refuseModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('refuseReasonInput').focus();
  }
}

function closeRefuseModal() {
  activeRefuseRequestId = null;
  const modal = document.getElementById('refuseModal');
  if (modal) {
    modal.classList.add('hidden');
    document.getElementById('refuseForm').reset();
  }
}

const refuseForm = document.getElementById('refuseForm');
if (refuseForm) {
  refuseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeRefuseRequestId) return;
    
    const reason = document.getElementById('refuseReasonInput').value.trim();
    if (!reason) return;
    
    try {
      const response = await fetch(`/api/request/${activeRefuseRequestId}/refuse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Erro ao recusar solicitação.');
      }
      showMessage(payload.message, 'success');
      closeRefuseModal();
      loadQueue();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });
}

window.openRefuseModal = openRefuseModal;
window.closeRefuseModal = closeRefuseModal;

function getItemRejectReason(item) {
  if (item && item.reject_reason && String(item.reject_reason).trim() !== '') {
    return String(item.reject_reason).trim();
  }
  if (item && Array.isArray(item.logs)) {
    for (const log of item.logs) {
      if (typeof log === 'string' && log.includes('Solicitação recusada pela Estratégia. Motivo: ')) {
        return log.split('Solicitação recusada pela Estratégia. Motivo: ')[1].trim();
      }
    }
  }
  return 'Sem motivo informado';
}

function openViewReasonModal(encodedReason) {
  const reason = decodeURIComponent(encodedReason);
  const modal = document.getElementById('viewReasonModal');
  const textEl = document.getElementById('viewReasonText');
  if (modal && textEl) {
    textEl.textContent = reason;
    modal.classList.remove('hidden');
  }
}

function closeViewReasonModal() {
  const modal = document.getElementById('viewReasonModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

window.openViewReasonModal = openViewReasonModal;
window.closeViewReasonModal = closeViewReasonModal;

uploadForm.addEventListener('submit', handleUpload);
finalizeButton.addEventListener('click', handleFinalizeButton);
enrichButton.addEventListener('click', () => {
  const actionMode = state.currentAction || 'enrich_only';
  const queryFields = Array.from(state.selectedQueryFields || []);

  if (actionMode !== 'queue_only' && queryFields.length === 0) {
    showMessage('Selecione ao menos uma variável para a consulta.', 'error');
    return;
  }

  if (actionMode !== 'queue_only') {
    const hasNome = queryFields.some(f => f.toLowerCase().includes('nome'));
    if (!hasNome) {
      showMessage('É obrigatório selecionar o campo de Nome para realizar o enriquecimento.', 'error');
      return;
    }
  }

  if (actionMode === 'queue_only') {
    openRequestModal();
  } else if (actionMode === 'enrich_only') {
    openRequesterModal();
  } else {
    startEnrichment("");
  }
});
requestForm.addEventListener('submit', submitRequest);
document.querySelectorAll('.close-modal').forEach((button) => button.addEventListener('click', closeRequestModal));
document.querySelectorAll('.close-logs-modal').forEach((button) => button.addEventListener('click', closeLogsModal));

// Queue tabs event listeners
document.querySelectorAll('.queue-tab').forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    const tabName = tab.dataset.queueTab;
    
    // Update active tab
    document.querySelectorAll('.queue-tab').forEach((t) => t.classList.remove('is-active'));
    tab.classList.add('is-active');
    
    // Show/hide content
    if (strategyQueueActive) {
      strategyQueueActive.classList.toggle('hidden', tabName !== 'active');
      strategyQueueActive.classList.toggle('is-visible', tabName === 'active');
    }
    if (strategyQueueHistoryQueue) {
      strategyQueueHistoryQueue.classList.toggle('hidden', tabName !== 'history_queue');
      strategyQueueHistoryQueue.classList.toggle('is-visible', tabName === 'history_queue');
    }
    if (strategyQueueHistoryEnrich) {
      strategyQueueHistoryEnrich.classList.toggle('hidden', tabName !== 'history_enrich');
      strategyQueueHistoryEnrich.classList.toggle('is-visible', tabName === 'history_enrich');
    }
  });
});

// Add click listeners to queue containers
[strategyQueueActive, strategyQueueHistoryQueue, strategyQueueHistoryEnrich].forEach((container) => {
  if (container) container.addEventListener('click', submitSummary);
});

// Logs Queue functions and polling
async function loadLogsQueue() {
  try {
    const response = await fetch('/api/queue');
    if (!response.ok) {
      throw new Error('Não foi possível carregar o histórico.');
    }
    const payload = await response.json();
    state.queue = payload.queue || [];
    renderLogsQueue();
  } catch (error) {
    console.error(error);
  }
}

function renderLogsQueue() {
  if (!logsList) return;
  if (!state.queue.length) {
    logsList.innerHTML = '<div class="queue-item"><strong>Nenhum registro de importação encontrado.</strong></div>';
    return;
  }

  logsList.innerHTML = '';
  state.queue.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'queue-item';

    let statusText = 'Pendente';
    let badgeClass = 'pending';
    if (item.status === 'processing') {
      const pct = item.total_rows > 0 ? Math.round((item.processed_count / item.total_rows) * 100) : 0;
      statusText = `Processando (${pct}%)`;
      badgeClass = 'processing';
    } else if (item.status === 'completed') {
      statusText = 'Concluído';
      badgeClass = 'completed';
    } else if (item.status === 'error') {
      statusText = 'Erro';
      badgeClass = 'error';
    }

    let downloadHtml = '';
    if (item.status === 'completed' || item.status === 'pending') {
      downloadHtml = `
        <button type="button" class="download-link-premium" style="display: inline-flex; align-items: center; gap: 8px; border: none; font-family: inherit;" onclick="downloadFileDirectly('/api/request/${item.id}/download')" title="Baixar Planilha">
          <svg viewBox="0 0 256 256" height="24" width="28" xmlns="http://www.w3.org/2000/svg">
            <path d="M74.34 85.66a8 8 0 0 1 11.32-11.32L120 108.69V24a8 8 0 0 1 16 0v84.69l34.34-34.35a8 8 0 0 1 11.32 11.32l-48 48a8 8 0 0 1-11.32 0ZM240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h52.4a4 4 0 0 1 2.83 1.17L111 145a24 24 0 0 0 34 0l23.8-23.8a4 4 0 0 1 2.8-1.2H224a16 16 0 0 1 16 16m-40 32a12 12 0 1 0-12 12a12 12 0 0 0 12-12" fill="currentColor"></path>
          </svg>
          <span>Download</span>
        </button>
      `;
    }

    row.innerHTML = `
      <div class="queue-header">
        <strong>Fila ${item.queue_number}</strong>
        <span class="badge ${badgeClass}">${statusText}</span>
      </div>
      <div class="queue-meta">Solicitante: ${item.requester_name}</div>
      <div class="queue-meta">Horário: ${item.request_time}</div>
      <div class="queue-meta">Progresso: ${item.processed_count || 0} / ${item.total_rows || 0} (Sucessos: ${item.success_count || 0}, Falhas: ${item.error_count || 0})</div>
      <div class="queue-actions">
        ${downloadHtml}
        <button type="button" class="button secondary" onclick="viewDetailedLogs('${item.id}')">Ver Logs</button>
      </div>
    `;
    logsList.appendChild(row);
  });
}

let logPollInterval = null;
let activeLogRequestId = null;

async function viewDetailedLogs(requestId) {
  activeLogRequestId = requestId;
  logsModal.classList.remove('hidden');

  await fetchAndRenderLogs(requestId);

  if (logPollInterval) {
    clearInterval(logPollInterval);
  }

  logPollInterval = setInterval(async () => {
    const isStillProcessing = await fetchAndRenderLogs(activeLogRequestId);
    if (!isStillProcessing) {
      clearInterval(logPollInterval);
      logPollInterval = null;
      loadLogsQueue();
      loadQueue();
    }
  }, 2000);
}

async function fetchAndRenderLogs(requestId) {
  try {
    const response = await fetch(`/api/request/${requestId}/logs`);
    if (!response.ok) {
      throw new Error('Falha ao buscar logs.');
    }
    const data = await response.json();

    logsModalTitle.textContent = `Logs da Fila (${data.status === 'processing' ? 'Processando' : 'Finalizado'})`;
    logCounterTotal.textContent = data.total_rows || 0;
    logCounterSuccess.textContent = data.success_count || 0;
    logCounterError.textContent = data.error_count || 0;

    if (data.logs && data.logs.length > 0) {
      logsModalContent.innerHTML = data.logs.join('\n');
      logsModalContent.scrollTop = logsModalContent.scrollHeight;
    } else {
      logsModalContent.innerHTML = 'Nenhum log registrado ainda.';
    }

    return data.status === 'processing';
  } catch (err) {
    logsModalContent.innerHTML = `Erro ao carregar logs: ${err.message}`;
    return false;
  }
}

function closeLogsModal() {
  logsModal.classList.add('hidden');
  activeLogRequestId = null;
  if (logPollInterval) {
    clearInterval(logPollInterval);
    logPollInterval = null;
  }
}

// Step 1: Render Query Fields selection box with assertiveness colors
function renderQueryFieldsSelection(columns) {
  const selectionDiv = document.getElementById('queryFieldsSelection');
  if (!selectionDiv) return;
  selectionDiv.innerHTML = '';

  const selectedQueryFields = new Set();

  columns.forEach((col) => {
    const norm = col.toLowerCase();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'field-tag';
    btn.textContent = labelize(col);

    // Color tags based on assertiveness
    if (norm.includes('nome') || norm.includes('cpf') || norm.includes('nasc')) {
      btn.classList.add('green');
      btn.classList.add('selected-query');
      selectedQueryFields.add(col);
    } else if (norm.includes('telefone') || norm.includes('celular') || norm.includes('fone')) {
      btn.classList.add('yellow');
      btn.classList.add('selected-query');
      selectedQueryFields.add(col);
    } else {
      btn.classList.add('neutral');
    }

    btn.addEventListener('click', () => {
      if (selectedQueryFields.has(col)) {
        selectedQueryFields.delete(col);
        btn.classList.remove('selected-query');
      } else {
        selectedQueryFields.add(col);
        btn.classList.add('selected-query');
      }
    });

    selectionDiv.appendChild(btn);
  });

  state.selectedQueryFields = selectedQueryFields;
}

// Step 2: Start background processing
async function startEnrichment(requesterName) {
  if (!state.currentRecord) return;

  // Transição IMEDIATA para a tela de progresso (Passo 2)
  step1Container.classList.add('hidden');
  step2Container.classList.remove('hidden');
  if (cancelEnrichButton) {
    cancelEnrichButton.classList.remove('hidden');
  }
  progressBarFill.style.width = '0%';
  progressText.textContent = 'Inicializando registros e preparando o enriquecimento...';
  uploadLogsBox.innerHTML = 'Conectando ao servidor...';

  const actionMode = state.currentAction || 'enrich_only';
  const queryFields = Array.from(state.selectedQueryFields || []);

  try {
    const response = await fetch('/api/request-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        record_id: state.currentRecord.id,
        query_fields: queryFields,
        mode: actionMode,
        requester_name: requesterName,
        rows: state.currentRecord ? state.currentRecord.rows : null
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Falha ao iniciar enriquecimento.');
    }

    state.activeRequestImportId = payload.request_id;
    pollUploadProgress(payload.request_id);
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

let uploadProgressInterval = null;

function ensureStepVisibility() {
  if (uploadForm) {
    uploadForm.classList.add('hidden');
  }
  if (step1Container) {
    step1Container.classList.add('hidden');
  }
  if (step2Container) {
    step2Container.classList.add('hidden');
  }
  if (step3Container) {
    step3Container.classList.add('hidden');
  }
}

let isPollingProgress = false;

function pollUploadProgress(requestId) {
  if (uploadProgressInterval) {
    clearInterval(uploadProgressInterval);
  }

  isPollingProgress = false;
  progressBarFill.style.width = '0%';
  progressText.textContent = 'Processando enriquecimento...';
  uploadLogsBox.innerHTML = '';

  // Reset stat fields at start
  if (statProcessed) statProcessed.textContent = '0 / 0';
  if (statSuccess) statSuccess.textContent = '0 (0%)';
  if (statError) statError.textContent = '0 (0%)';
  if (statTimeRemaining) statTimeRemaining.textContent = 'Calculando...';

  const startTime = Date.now();

  uploadProgressInterval = setInterval(async () => {
    if (isPollingProgress) return;
    isPollingProgress = true;
    try {
      const response = await fetch(`/api/request/${requestId}/logs`);
      if (!response.ok) {
        return; // Ignora falhas pontuais e tenta no próximo ciclo
      }
      const data = await response.json();

      const pct = data.total_rows > 0 ? Math.round((data.processed_count / data.total_rows) * 100) : 0;
      progressBarFill.style.width = `${pct}%`;
      progressText.textContent = `Processando: ${data.processed_count} de ${data.total_rows} (${pct}%) — ${data.success_count} sucessos, ${data.error_count} falhas.`;

      // Update statistics cards
      if (statProcessed) statProcessed.textContent = `${data.processed_count} / ${data.total_rows}`;
      if (statSuccess) {
        const pctSuccess = data.total_rows > 0 ? Math.round((data.success_count / data.total_rows) * 100) : 0;
        statSuccess.textContent = `${data.success_count} (${pctSuccess}%)`;
      }
      if (statError) {
        const pctError = data.total_rows > 0 ? Math.round((data.error_count / data.total_rows) * 100) : 0;
        statError.textContent = `${data.error_count} (${pctError}%)`;
      }
      if (statTimeRemaining) {
        const elapsed = (Date.now() - startTime) / 1000;
        if (data.processed_count > 0 && data.status === 'processing') {
          const rate = data.processed_count / elapsed;
          const remaining = data.total_rows - data.processed_count;
          const estSec = Math.ceil(remaining / rate);
          statTimeRemaining.textContent = estSec > 0 ? `${estSec}s` : '0s';
        } else if (data.status !== 'processing') {
          statTimeRemaining.textContent = '0s';
        } else {
          statTimeRemaining.textContent = 'Calculando...';
        }
      }

      if (data.logs && data.logs.length > 0) {
        uploadLogsBox.innerHTML = data.logs.join('\n');
        uploadLogsBox.scrollTop = uploadLogsBox.scrollHeight;
      }

      // Update Processing Steps UI
      const steps = {
        carregando: document.getElementById('stepCarregando'),
        enriquecendo: document.getElementById('stepEnriquecendo'),
        tratando: document.getElementById('stepTratando'),
        finalizando: document.getElementById('stepFinalizando')
      };

      const setStepStatus = (stepId, status) => {
        const el = steps[stepId];
        if (!el) return;
        const icon = el.querySelector('.step-icon');
        el.className = 'processing-step';
        icon.className = 'step-icon';
        if (status === 'active') {
          el.classList.add('active');
          icon.classList.add('spinner');
        } else if (status === 'completed') {
          el.classList.add('completed');
        }
      };

      // Elementos de detalhe por etapa
      const stepCarregandoDetail = document.getElementById('stepCarregandoDetail');
      const stepEnriquecendoDetail = document.getElementById('stepEnriquecendoDetail');
      const stepTratandoDetail = document.getElementById('stepTratandoDetail');
      const stepFinalizandoDetail = document.getElementById('stepFinalizandoDetail');

      const totalRowsFormatted = (data.total_rows || 0).toLocaleString('pt-BR');
      const processedFormatted = (data.processed_count || 0).toLocaleString('pt-BR');

      if (data.total_rows > 0 && stepCarregandoDetail) {
        stepCarregandoDetail.textContent = `Planilha de ${totalRowsFormatted} registros validada com sucesso`;
      }

      if (pct < 100 && data.status === 'processing') {
        setStepStatus('carregando', 'completed');
        setStepStatus('enriquecendo', 'active');
        if (stepEnriquecendoDetail) {
          stepEnriquecendoDetail.textContent = `Consultando ${processedFormatted} de ${totalRowsFormatted} (${pct}%) — ${data.success_count} localizados, ${data.error_count} sem registro`;
        }

        if (pct >= 85) {
          setStepStatus('tratando', 'active');
          if (stepTratandoDetail) {
            stepTratandoDetail.textContent = `Formatando e-mails minúsculos e validando campos...`;
          }
        } else {
          setStepStatus('tratando', 'pending');
          if (stepTratandoDetail) {
            stepTratandoDetail.textContent = `Aguardando progresso das consultas...`;
          }
        }

        if (pct >= 95) {
          setStepStatus('finalizando', 'active');
          if (stepFinalizandoDetail) {
            stepFinalizandoDetail.textContent = `Compilando planilha Excel final com todos os atributos...`;
          }
        } else {
          setStepStatus('finalizando', 'pending');
          if (stepFinalizandoDetail) {
            stepFinalizandoDetail.textContent = `Aguardando conciliação final...`;
          }
        }
      } else if (data.status !== 'processing') {
        clearInterval(uploadProgressInterval);
        uploadProgressInterval = null;
        if (cancelEnrichButton) {
          cancelEnrichButton.classList.add('hidden');
        }

        const sampleRow = (data.rows && data.rows.length > 0) ? data.rows[0] : (data.preview || {});
        state.currentRecord = {
          id: requestId,
          type: data.detected_type || 'NOME',
          columns: Object.keys(sampleRow),
          available_fields: Object.keys(sampleRow),
          rows: data.rows || [],
          preview: sampleRow
        };
        state.processedCount = data.processed_count || 0;
        state.successCount = data.success_count || 0;
        state.errorCount = data.error_count || 0;
        state.detectedType = data.detected_type || 'NOME';

        if (data.status === 'error') {
          progressText.textContent = 'Erro durante o enriquecimento.';
          showMessage('Erro ao processar lote no plano de fundo. Veja os logs.', 'error');
        } else if (data.status === 'cancelled') {
          progressText.textContent = 'Enriquecimento cancelado.';
          showMessage('O processamento foi cancelado pelo usuário.', 'error');
          setTimeout(() => {
            step2Container.classList.add('hidden');
            step1Container.classList.remove('hidden');
            hideMessage();
          }, 3000);
        } else {
          // PROCESSO 100% CONCLUÍDO
          progressBarFill.style.width = '100%';
          progressText.textContent = '✨ Processamento 100% Concluído com Sucesso!';

          setStepStatus('carregando', 'completed');
          setStepStatus('enriquecendo', 'completed');
          setStepStatus('tratando', 'completed');
          setStepStatus('finalizando', 'completed');

          if (stepCarregandoDetail) stepCarregandoDetail.textContent = `Planilha validada (${totalRowsFormatted} registros)`;
          if (stepEnriquecendoDetail) stepEnriquecendoDetail.textContent = `100% concluído (${totalRowsFormatted} consultas processadas na Nova Vida TI)`;
          if (stepTratandoDetail) stepTratandoDetail.textContent = `E-mails em minúsculo e dados tratados com sucesso`;
          if (stepFinalizandoDetail) stepFinalizandoDetail.textContent = `Planilha Excel compilada e pronta para download!`;

          // Mantém a tela visível por 2.5 segundos antes de transicionar
          setTimeout(() => {
            if (state.currentAction === 'enrich_and_queue') {
              step2Container.classList.add('hidden');
              openQueueModal();
            } else {
              step2Container.classList.add('hidden');
              step3Container.classList.remove('hidden');
              renderAvailableFields();
              renderSelectedFields();
              renderPreview();
              finalizeButton.textContent = 'Baixar arquivo enriquecido';
              finalizeButton.onclick = () => {
                if (state.activeRequestImportId) {
                  downloadFileDirectly(`/api/request/${state.activeRequestImportId}/download`);
                }
              };
            }
          }, 2500);
        }
      }
    } catch (err) {
      console.error('Erro no pollUploadProgress:', err);
    }
  }, 500);
}

// Background auto-refresh for queue and logs based on visible panel
setInterval(() => {
  const visiblePanel = Object.entries(panels).find(([key, panel]) => panel && panel.classList.contains('is-visible'));
  if (visiblePanel) {
    const target = visiblePanel[0];
    const userRole = document.body.dataset.userRole;
    if (target === 'strategy-panel' && userRole === 'admin') {
      loadQueue();
    } else if (target === 'user-panel') {
      loadQueue();
    } else if (target === 'logs-panel') {
      loadLogsQueue();
    }
  }
}, 10000);

// Global viewDetailedLogs registration
window.viewDetailedLogs = viewDetailedLogs;

applyRoleAccess();
// Activate initial panel based on the starting role
if (state.currentRole === 'admin') {
  setActiveTab('strategy-panel');
} else {
  setActiveTab('user-panel');
}
ensureStepVisibility();
renderAvailableFields();
renderSelectedFields();
renderPreview();
updateRequestButtonState();
loadQueue();
loadNotifications();

async function cancelEnrichment() {
  const requestId = state.activeRequestImportId;
  if (!requestId) return;

  const btn = document.getElementById('cancelEnrichButton');
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Cancelando...';
    }
    const response = await fetch(`/api/request/${requestId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Erro ao cancelar enriquecimento.');
    }
    showMessage(payload.message, 'success');
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Cancelar Enriquecimento';
    }
  }
}

const cancelEnrichButton = document.getElementById('cancelEnrichButton');
const toggleLogsButton = document.getElementById('toggleLogsButton');

if (toggleLogsButton) {
  toggleLogsButton.addEventListener('click', () => {
    if (uploadLogsBox.classList.contains('hidden')) {
      uploadLogsBox.classList.remove('hidden');
      toggleLogsButton.textContent = 'Ocultar Logs Técnicos';
    } else {
      uploadLogsBox.classList.add('hidden');
      toggleLogsButton.textContent = 'Mostrar Logs Técnicos';
    }
  });
}

if (cancelEnrichButton) {
  cancelEnrichButton.addEventListener('click', cancelEnrichment);
}

// Drag & Drop File Upload listeners
const excelFile = document.getElementById('excelFile');
if (dropZone && excelFile) {
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('drop-zone--over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('drop-zone--over');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      excelFile.files = files;
      // Dispatch change event to update drop-zone text and borders
      excelFile.dispatchEvent(new Event('change'));
    }
  }, false);

  // Listener to display attached file name in the drop-zone
  excelFile.addEventListener('change', () => {
    const file = excelFile.files[0];
    if (file) {
      const textEl = dropZone.querySelector('.drop-zone-text');
      if (textEl) {
        const attachedText = `Planilha selecionada: ${file.name}`;
        textEl.textContent = attachedText;
        textEl.dataset.originalText = attachedText;
      }
      dropZone.classList.add('drop-zone--attached');
      showToast(`Planilha "${file.name}" anexada! Pronto para validar.`, 'info');
    } else {
      dropZone.classList.remove('drop-zone--attached');
    }
  });
}

// Warning box buttons click listeners
if (btnProceedValidation) {
  btnProceedValidation.addEventListener('click', () => {
    if (validationWarningBox) validationWarningBox.classList.add('hidden');
    if (state.currentAction === 'queue_only') {
      if (step3Container) {
        step3Container.classList.remove('hidden');
        renderAvailableFields();
        renderSelectedFields();
        renderPreview();
      }
    } else {
      if (step1Container) step1Container.classList.remove('hidden');
    }
    showToast("Planilha aceita pelo usuário.", "info");
  });
}

if (btnCancelValidation) {
  btnCancelValidation.addEventListener('click', () => {
    if (validationWarningBox) validationWarningBox.classList.add('hidden');
    if (uploadForm) uploadForm.reset();
    state.currentRecord = null;
    state.selectedFields = [];

    // Reset drop-zone text and borders
    if (dropZone) {
      dropZone.classList.remove('drop-zone--attached');
      const textEl = dropZone.querySelector('.drop-zone-text');
      if (textEl) {
        textEl.textContent = 'Arrastar e soltar arquivo aqui (.xlsx, .csv) ou clique para selecionar';
        textEl.dataset.originalText = textEl.textContent;
      }
    }
    showToast("Envie uma planilha corrigida.", "warning");
  });
}

// Color theme switching logic
const themeButtons = document.querySelectorAll('.theme-btn');

function setTheme(themeName) {
  document.body.setAttribute('data-theme', themeName);
  localStorage.setItem('selected-theme', themeName);

  themeButtons.forEach(btn => {
    if (btn.dataset.themeName === themeName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Attach event listeners to theme buttons
themeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const themeName = btn.dataset.themeName;
    setTheme(themeName);
  });
});

// Load theme on startup
const savedTheme = localStorage.getItem('selected-theme') || 'classic';
setTheme(savedTheme);

// Add mouse wheel zoom listener to viewerImage
document.addEventListener('DOMContentLoaded', () => {
  const img = document.getElementById('viewerImage');
  if (img) {
    const applyTransform = () => {
      const container = img.parentElement;
      if (container) {
        // Safe boundaries to prevent image from sliding completely off screen
        const maxTranslateX = Math.max(0, (img.clientWidth * currentZoom - container.clientWidth) / 2) + (container.clientWidth * 0.15);
        const maxTranslateY = Math.max(0, (img.clientHeight * currentZoom - container.clientHeight) / 2) + (container.clientHeight * 0.15);
        translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX));
        translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
      }
      img.style.transform = `scale(${currentZoom}) translate(${translateX}px, ${translateY}px)`;
    };

    img.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomSpeed = 0.15;
      if (e.deltaY < 0) {
        currentZoom = Math.min(3, currentZoom + zoomSpeed);
      } else {
        currentZoom = Math.max(0.5, currentZoom - zoomSpeed);
      }
      applyTransform();
    });

    img.addEventListener('mousedown', (e) => {
      isPanning = true;
      img.style.cursor = 'grabbing';
      startX = e.clientX - translateX * currentZoom;
      startY = e.clientY - translateY * currentZoom;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      translateX = (e.clientX - startX) / currentZoom;
      translateY = (e.clientY - startY) / currentZoom;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      if (img) {
        img.style.cursor = 'grab';
      }
    });
  }
});
