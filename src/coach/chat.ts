import { el, clear } from '../ui/dom';
import { icons } from '../ui/icons';
import { errorMessage } from '../ui/toast';
import { sendCoachMessage } from './api';
import type { ChatMessage } from '../lib/types';

const WELCOME =
  'Hola, soy tu coach de KROTON HABITOS. Ya puedo ver tus hábitos, tu racha, tus metas y tu agenda reales — pregúntame lo que quieras sobre ellos, o algo de disciplina y constancia en general.';

const SUGGESTIONS = [
  '¿Qué tengo agendado hoy?',
  '¿Cómo voy esta semana?',
  '¿Qué opinas de mis metas?',
  'Ayúdame a no romper mi racha',
];

const INPUT_MAX_HEIGHT = 120;

/**
 * Pinta el chat con el coach de IA dentro del panel flotante. Se monta una
 * sola vez por sesión (lazy, al abrir el panel la primera vez). `onClose` se
 * engancha al botón ✕ del encabezado.
 */
export function renderCoachChat(root: HTMLElement, onClose: () => void): void {
  clear(root);

  // Historial en memoria: se manda al backend para que el coach tenga contexto
  // de la conversación, pero no se guarda en la base de datos.
  const history: ChatMessage[] = [];

  const messages = el('div', { class: 'chat__messages', role: 'log', 'aria-live': 'polite' });

  const input = el('textarea', {
    class: 'chat__input',
    placeholder: 'Escríbele al coach…',
    rows: 1,
  });
  const sendBtn = el(
    'button',
    { class: 'btn btn--primary chat__send', type: 'submit', 'aria-label': 'Enviar mensaje' },
    [icons.send()],
  );

  const suggestions = el(
    'div',
    { class: 'chat__suggestions' },
    SUGGESTIONS.map((text) => {
      const chip = el('button', { class: 'chat__chip', type: 'button' }, [text]);
      chip.addEventListener('click', () => {
        input.value = text;
        void onSend();
      });
      return chip;
    }),
  );

  const form = el('form', { class: 'chat__composer' }, [input, sendBtn]);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void onSend();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void onSend();
    }
  });
  input.addEventListener('input', () => autoGrow());

  const closeBtn = el(
    'button',
    { class: 'btn btn--icon chat__close', type: 'button', 'aria-label': 'Cerrar chat' },
    [icons.close()],
  );
  closeBtn.addEventListener('click', onClose);

  const header = el('div', { class: 'chat__head' }, [
    el('span', { class: 'chat__head-mark', 'aria-hidden': 'true' }, [icons.sparkles()]),
    el('div', { class: 'chat__head-body' }, [
      el('h2', { class: 'card__title chat__head-title' }, ['Coach']),
      el('p', { class: 'chat__head-subtitle' }, ['Tu guía de constancia, disponible cuando la necesites']),
    ]),
    closeBtn,
  ]);

  const card = el('section', { class: 'card--chat' }, [header, messages, suggestions, form]);

  root.append(card);
  appendMessage('assistant', WELCOME);
  autoGrow();
  input.focus();

  // Crece renglón a renglón con el texto (como un chat de IA moderno) en vez
  // de mostrar un scroll interno; solo se habilita el scroll si se llega al
  // alto máximo.
  function autoGrow(): void {
    input.style.height = 'auto';
    const next = Math.min(input.scrollHeight, INPUT_MAX_HEIGHT);
    input.style.height = `${next}px`;
    input.style.overflowY = input.scrollHeight > INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }

  function avatar(): HTMLElement {
    return el('span', { class: 'chat__avatar', 'aria-hidden': 'true' }, [icons.sparkles()]);
  }

  function appendMessage(role: ChatMessage['role'], text: string): HTMLElement {
    const bubble = el('div', { class: `chat__bubble chat__bubble--${role}` }, [text]);
    const rowChildren = role === 'assistant' ? [avatar(), bubble] : [bubble];
    const row = el('div', { class: `chat__row chat__row--${role}` }, rowChildren);
    messages.append(row);
    messages.scrollTop = messages.scrollHeight;
    return row;
  }

  function appendTyping(): HTMLElement {
    const bubble = el('div', { class: 'chat__bubble chat__bubble--assistant chat__bubble--typing' }, [
      el('span', { class: 'chat__dot' }),
      el('span', { class: 'chat__dot' }),
      el('span', { class: 'chat__dot' }),
    ]);
    const row = el('div', { class: 'chat__row chat__row--assistant' }, [avatar(), bubble]);
    messages.append(row);
    messages.scrollTop = messages.scrollHeight;
    return row;
  }

  async function onSend(): Promise<void> {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    autoGrow();
    input.setAttribute('disabled', 'true');
    sendBtn.setAttribute('disabled', 'true');
    suggestions.style.display = 'none';

    appendMessage('user', text);
    history.push({ role: 'user', text });

    const typingRow = appendTyping();

    try {
      const reply = await sendCoachMessage(text, history);
      typingRow.remove();
      appendMessage('assistant', reply);
      history.push({ role: 'assistant', text: reply });
    } catch (err) {
      typingRow.remove();
      appendMessage('assistant', errorMessage(err, 'No pude responder. Intenta de nuevo.'));
    } finally {
      input.removeAttribute('disabled');
      sendBtn.removeAttribute('disabled');
      input.focus();
    }
  }
}
