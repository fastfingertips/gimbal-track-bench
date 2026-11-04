/**
 * UIManager binds global header controls (Play/Pause, Speed, Mode Selector)
 * and dynamically populates mode-specific parameters.
 */
export class UIManager {
  constructor({ onPlayPauseToggle, onSpeedChange, onModeChange }) {
    this.onPlayPauseToggle = onPlayPauseToggle;
    this.onSpeedChange = onSpeedChange;
    this.onModeChange = onModeChange;

    this.isPaused = false;
    this.currentSpeed = 1.0;

    this.modeSelect = document.getElementById('modeSelect');
    this.togglePlayBtn = document.getElementById('togglePlayBtn');
    this.toggleIcon = document.getElementById('toggleIcon');
    this.toggleText = document.getElementById('toggleText');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedValue = document.getElementById('speedValue');
    this.modeDescription = document.getElementById('modeDescription');
    this.modeControlsContainer = document.getElementById('modeSpecificControls');

    this.bindGlobalEvents();
  }

  populateModeList(modes, selectedId) {
    this.modeSelect.innerHTML = '';
    modes.forEach((mode) => {
      const option = document.createElement('option');
      option.value = mode.id;
      option.textContent = mode.name;
      if (mode.id === selectedId) {
        option.selected = true;
      }
      this.modeSelect.appendChild(option);
    });
  }

  bindGlobalEvents() {
    this.togglePlayBtn.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      this.updatePlayPauseUI();
      if (this.onPlayPauseToggle) {
        this.onPlayPauseToggle(this.isPaused);
      }
    });

    this.speedSlider.addEventListener('input', (e) => {
      this.currentSpeed = parseFloat(e.target.value);
      this.speedValue.textContent = `${this.currentSpeed.toFixed(1)}x`;
      if (this.onSpeedChange) {
        this.onSpeedChange(this.currentSpeed);
      }
    });

    this.modeSelect.addEventListener('change', (e) => {
      if (this.onModeChange) {
        this.onModeChange(e.target.value);
      }
    });
  }

  updatePlayPauseUI() {
    if (this.isPaused) {
      this.toggleIcon.textContent = '▶';
      this.toggleText.textContent = 'Play';
    } else {
      this.toggleIcon.textContent = '⏸';
      this.toggleText.textContent = 'Pause';
    }
  }

  renderModeControls(modeInstance) {
    if (this.modeDescription) {
      this.modeDescription.textContent = modeInstance.description || '';
    }

    this.modeControlsContainer.innerHTML = '';
    const controls = modeInstance.getControls();

    controls.forEach((ctrl) => {
      const item = document.createElement('div');
      item.className = 'control-item';

      if (ctrl.type === 'range') {
        const label = document.createElement('label');
        label.htmlFor = `ctrl-${ctrl.id}`;
        label.innerHTML = `${ctrl.label}: <span class="badge" id="val-${ctrl.id}">${ctrl.value}${ctrl.unit || ''}</span>`;

        const input = document.createElement('input');
        input.id = `ctrl-${ctrl.id}`;
        input.type = 'range';
        input.min = ctrl.min;
        input.max = ctrl.max;
        input.step = ctrl.step || 1;
        input.value = ctrl.value;

        input.addEventListener('input', (e) => {
          const valBadge = document.getElementById(`val-${ctrl.id}`);
          if (valBadge) {
            valBadge.textContent = `${e.target.value}${ctrl.unit || ''}`;
          }
          ctrl.onChange(e.target.value);
        });

        item.appendChild(label);
        item.appendChild(input);
      } else if (ctrl.type === 'checkbox') {
        item.classList.add('control-item-checkbox');
        const label = document.createElement('label');
        label.className = 'checkbox-label';

        const input = document.createElement('input');
        input.id = `ctrl-${ctrl.id}`;
        input.type = 'checkbox';
        input.checked = !!ctrl.value;

        input.addEventListener('change', (e) => {
          ctrl.onChange(e.target.checked);
        });

        const span = document.createElement('span');
        span.textContent = ctrl.label;

        label.appendChild(input);
        label.appendChild(span);
        item.appendChild(label);
      }

      this.modeControlsContainer.appendChild(item);
    });
  }
}
