(() => {
  // --- DOM ---
  const finalTextEl  = document.getElementById('final-text');
  const interimTextEl = document.getElementById('interim-text');
  const placeholderEl = document.getElementById('placeholder');
  const statusEl     = document.getElementById('status');
  const btnStart     = document.getElementById('btn-start');
  const btnStop      = document.getElementById('btn-stop');
  const btnClear     = document.getElementById('btn-clear');
  const btnCopy      = document.getElementById('btn-copy');
  const langBtns     = document.querySelectorAll('.lang-btn');

  // --- 状態 ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus('このブラウザは音声認識に対応していません。Chrome または Edge をお使いください。', true);
    return;
  }

  let recognition    = null;
  let finalTranscript = '';
  let currentLang    = 'ja-JP';
  let isUserStopped  = false;  // ユーザーが意図的に停止したか
  let noSpeechCount  = 0;      // no-speech 連続回数
  const MAX_NO_SPEECH = 3;

  // --- 音声認識の初期化 ---
  function buildRecognition() {
    const r = new SpeechRecognition();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = currentLang;

    r.onstart = () => {
      noSpeechCount = 0;
      setState('recording');
    };

    r.onresult = (event) => {
      // resultIndex から始めることで確定テキストの重複を防ぐ
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTextEl.textContent = transcript;
        }
      }
      finalTextEl.textContent = finalTranscript;
      placeholderEl.hidden = finalTranscript.length > 0 || interimTextEl.textContent.length > 0;
    };

    r.onerror = (event) => {
      if (event.error === 'aborted') return; // 正常停止

      const messages = {
        'not-allowed':         'マイクへのアクセスを許可してください。',
        'no-speech':           '音声が検出されませんでした。',
        'network':             'ネットワーク接続を確認してください。',
        'audio-capture':       'マイクが見つかりません。',
        'service-not-allowed': 'HTTPSが必要です。',
      };
      const msg = messages[event.error] || `エラーが発生しました (${event.error})`;

      if (event.error === 'no-speech') {
        noSpeechCount++;
        if (noSpeechCount < MAX_NO_SPEECH) return; // 自動再起動に任せる
        isUserStopped = true;
        setStatus('無音が続いたため停止しました。', false);
        setState('idle');
        return;
      }

      isUserStopped = true;
      setStatus(msg, true);
      setState('idle');
    };

    // Safari は continuous=true でも無音時に onend が発火する。
    // isUserStopped フラグで「ユーザーが止めた」か「Safari が自動停止した」かを区別する。
    r.onend = () => {
      interimTextEl.textContent = '';
      if (isUserStopped) {
        setState('idle');
      } else {
        // 自動停止 → 再起動して継続
        try {
          recognition.start();
        } catch {
          setState('idle');
        }
      }
    };

    return r;
  }

  // --- 状態管理 ---
  function setState(state) {
    if (state === 'recording') {
      btnStart.disabled = true;
      btnStop.disabled  = false;
      btnStart.classList.add('recording');
      btnStart.textContent = '録音中...';
      setStatus('録音中', false);
    } else {
      btnStart.disabled = false;
      btnStop.disabled  = true;
      btnStart.classList.remove('recording');
      btnStart.textContent = '録音開始';
      if (state === 'idle' && statusEl.textContent === '録音中') {
        setStatus('停止しました', false);
      }
    }
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', isError);
  }

  // --- ボタン操作 ---
  btnStart.addEventListener('click', () => {
    isUserStopped = false;
    noSpeechCount = 0;
    recognition   = buildRecognition();
    try {
      recognition.start();
    } catch (e) {
      setStatus('録音を開始できませんでした。', true);
    }
  });

  btnStop.addEventListener('click', () => {
    isUserStopped = true;
    recognition?.stop();
  });

  btnClear.addEventListener('click', () => {
    finalTranscript = '';
    finalTextEl.textContent  = '';
    interimTextEl.textContent = '';
    placeholderEl.hidden = false;
    setStatus('クリアしました', false);
  });

  btnCopy.addEventListener('click', async () => {
    const text = finalTranscript + interimTextEl.textContent;
    if (!text) {
      setStatus('コピーするテキストがありません', false);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('コピーしました', false);
    } catch {
      setStatus('コピーに失敗しました', true);
    }
  });

  // --- 言語切替 ---
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.lang === currentLang) return;

      // 認識中は一旦停止してから言語を切り替える
      const wasRecording = !btnStart.disabled;
      if (!wasRecording) {
        isUserStopped = true;
        recognition?.stop();
      }

      currentLang = btn.dataset.lang;
      langBtns.forEach(b => b.classList.toggle('active', b === btn));

      if (!wasRecording) {
        isUserStopped = false;
        setTimeout(() => {
          recognition = buildRecognition();
          recognition.start();
        }, 200); // stop() の完了を待つ
      }
    });
  });

  // --- 初期化完了 ---
  btnStart.disabled = false;
  setStatus('待機中', false);
})();
