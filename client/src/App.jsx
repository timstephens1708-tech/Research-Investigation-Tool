import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [queries, setQueries] = useState({}); // { roundId: [queries] }
  const [sources, setSources] = useState([]);
  const [extracts, setExtracts] = useState({}); // { sourceId: [extracts] }
  const [roundSources, setRoundSources] = useState({}); // { roundId: [sources] }
  const [evidence, setEvidence] = useState({}); // { sourceId: [evidence] }
  const [activeSourceId, setActiveSourceId] = useState(null); // For Extract/Evidence Mode

  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showRoundForm, setShowRoundForm] = useState(false);
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { x, y, roundId }

  // Form States
  const [projectForm, setProjectForm] = useState({ title: '', research_question: '', hypothesis: '' });
  const [roundForm, setRoundForm] = useState({ label: 'A', objective: '' });
  const [sourceForm, setSourceForm] = useState({
    url: '', source_type: 'article', roundId: '', title: '', author: '', publisher: '', published_at: '', summary: '', notes: ''
  });
  const [extractForm, setExtractForm] = useState({ extract_type: 'quote', extract_text: '', context_text: '', location_ref: '' });
  const [evidenceForm, setEvidenceForm] = useState({
    evidence_type: 'quote', evidence_text: '', context_text: '', location_ref: '', why_relevant: '', extract_id: ''
  });
  const [queryForm, setQueryForm] = useState({ roundId: '', text: '', date: new Date().toISOString().split('T')[0] });

  useEffect(() => { fetchProjects(); }, []);

  const clearMessages = () => { setErrorMsg(''); setSuccessMsg(''); };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/projects`);
      setProjects(await res.json());
      setLoading(false);
    } catch (err) { console.error(err); setLoading(false); }
  };

  const fetchProjectData = async (projectId) => {
    try {
      const [roundsRes, sourcesRes] = await Promise.all([
        fetch(`${API_BASE}/projects/${projectId}/rounds`),
        fetch(`${API_BASE}/projects/${projectId}/sources`)
      ]);
      const roundsData = await roundsRes.json();
      const sourcesData = await sourcesRes.json();
      setRounds(roundsData);
      setSources(sourcesData);

      roundsData.forEach(r => {
        fetchQueries(r.id);
        fetchRoundSources(r.id);
      });
      sourcesData.forEach(s => {
        fetchExtracts(s.id);
        fetchEvidence(s.id);
      });
    } catch (err) { console.error(err); }
  };

  const fetchQueries = async (roundId) => {
    try {
      const res = await fetch(`${API_BASE}/rounds/${roundId}/queries`);
      const data = await res.json();
      setQueries(prev => ({ ...prev, [roundId]: data }));
    } catch (err) { console.error(err); }
  };

  const fetchRoundSources = async (roundId) => {
    try {
      const res = await fetch(`${API_BASE}/rounds/${roundId}/sources`);
      const data = await res.json();
      setRoundSources(prev => ({ ...prev, [roundId]: data }));
    } catch (err) { console.error(err); }
  };

  const fetchExtracts = async (sourceId) => {
    try {
      const res = await fetch(`${API_BASE}/sources/${sourceId}/extracts`);
      const data = await res.json();
      setExtracts(prev => ({ ...prev, [sourceId]: data }));
    } catch (err) { console.error(err); }
  };

  const fetchEvidence = async (sourceId) => {
    try {
      const res = await fetch(`${API_BASE}/sources/${sourceId}/evidence`);
      const data = await res.json();
      setEvidence(prev => ({ ...prev, [sourceId]: data }));
    } catch (err) { console.error(err); }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    clearMessages();
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectForm)
    });
    if (res.ok) {
      setProjectForm({ title: '', research_question: '', hypothesis: '' });
      setShowProjectForm(false);
      fetchProjects();
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleCreateRound = async (e) => {
    e.preventDefault();
    clearMessages();
    const res = await fetch(`${API_BASE}/projects/${selectedProject.id}/rounds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roundForm)
    });
    if (res.ok) {
      setRoundForm({ label: 'A', objective: '' });
      setShowRoundForm(false);
      fetchProjectData(selectedProject.id);
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleDeleteRound = async (roundId) => {
    if (!window.confirm('Weet je zeker dat je deze onderzoeksfase wilt verwijderen? Dit verwijdert alle gekoppelde zoekopdrachten, maar de bronnen blijven bewaard in de bibliotheek.')) return;
    const res = await fetch(`${API_BASE}/rounds/${roundId}`, { method: 'DELETE' });
    if (res.ok) {
      setSuccessMsg('Fase verwijderd.');
      fetchProjectData(selectedProject.id);
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleAddSource = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!sourceForm.roundId) return setErrorMsg('Selectie van een fase is verplicht.');

    const res = await fetch(`${API_BASE}/projects/${selectedProject.id}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sourceForm)
    });

    if (res.ok) {
      const data = await res.json();
      setSuccessMsg(data.message === 'Source linked to round.' ? 'Bron gekoppeld aan fase.' : 'Bron aangemaakt en gekoppeld.');
      setSourceForm({ url: '', source_type: 'article', roundId: '', title: '', author: '', publisher: '', published_at: '', summary: '', notes: '' });
      setShowSourceForm(false);
      fetchProjectData(selectedProject.id);
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleAddExtract = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!extractForm.extract_text.trim() || !extractForm.context_text.trim() || !extractForm.location_ref.trim()) {
      return setErrorMsg('Alle velden (Citaat, Context, Locatie) zijn verplicht.');
    }

    const res = await fetch(`${API_BASE}/sources/${activeSourceId}/extracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extractForm)
    });

    if (res.ok) {
      setSuccessMsg('Abstract vastgelegd.');
      setExtractForm({ extract_type: 'quote', extract_text: '', context_text: '', location_ref: '' });
      fetchExtracts(activeSourceId);
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleAddEvidence = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!evidenceForm.evidence_text.trim() || !evidenceForm.why_relevant.trim() || !evidenceForm.context_text.trim() || !evidenceForm.location_ref.trim()) {
      return setErrorMsg('Alle velden (Bewijs, Context, Locatie, Relevantie) zijn verplicht.');
    }

    const res = await fetch(`${API_BASE}/sources/${activeSourceId}/evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evidenceForm)
    });

    if (res.ok) {
      setSuccessMsg('Bewijsstuk vastgelegd.');
      setEvidenceForm({ evidence_type: 'quote', evidence_text: '', context_text: '', location_ref: '', why_relevant: '', extract_id: '' });
      fetchEvidence(activeSourceId);
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleDeleteEvidence = async (evidenceId) => {
    if (!window.confirm('Bewijsstuk verwijderen uit dossier?')) return;
    const res = await fetch(`${API_BASE}/evidence/${evidenceId}`, { method: 'DELETE' });
    if (res.ok) fetchEvidence(activeSourceId);
  };

  const useExtractAsEvidence = (ex) => {
    setEvidenceForm({
      evidence_type: ex.extract_type,
      evidence_text: ex.extract_text,
      context_text: ex.context_text,
      location_ref: ex.location_ref,
      why_relevant: '',
      extract_id: ex.id
    });
    // Scroll to form or focus
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExtract = async (extractId) => {
    if (!window.confirm('Citaat verwijderen?')) return;
    const res = await fetch(`${API_BASE}/extracts/${extractId}`, { method: 'DELETE' });
    if (res.ok) fetchExtracts(activeSourceId);
  };

  const handleLogQuery = async (roundId) => {
    clearMessages();
    const queryText = (queryForm.roundId === roundId ? queryForm.text : '').trim();
    const queryDate = (queryForm.roundId === roundId ? queryForm.date : '') || new Date().toISOString().split('T')[0];

    if (!queryText) return setErrorMsg('Voer a.u.b. een zoekterm in.');

    const res = await fetch(`${API_BASE}/rounds/${roundId}/queries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query_text: queryText,
        executed_at: queryDate
      })
    });
    if (res.ok) {
      setQueryForm({ roundId: '', text: '', date: new Date().toISOString().split('T')[0] });
      fetchQueries(roundId);
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleLinkSource = async (roundId, sourceId) => {
    const res = await fetch(`${API_BASE}/rounds/${roundId}/sources/${sourceId}/link`, { method: 'POST' });
    if (res.ok) {
      setSuccessMsg('Bron gekoppeld aan fase.');
      fetchRoundSources(roundId);
    } else {
      const err = await res.json();
      setErrorMsg(err.error);
    }
  };

  const handleArchiveSource = async (e, sourceId) => {
    e.stopPropagation();
    if (!window.confirm('Deze bron archiveren? De bron blijft bewaard in de database voor bewijsvoering, maar wordt verborgen uit standaard lijsten.')) return;
    const res = await fetch(`${API_BASE}/sources/${sourceId}/archive`, { method: 'POST' });
    if (res.ok) fetchProjectData(selectedProject.id);
  };

  const handleContextMenu = (e, roundId) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, roundId });
  };

  const handleExportProject = async () => {
    clearMessages();
    setLoading(true);
    setSuccessMsg('Rapport wordt gegenereerd, een moment geduld...');

    try {
      const res = await fetch(`${API_BASE}/projects/${selectedProject.id}/export`, {
        method: 'POST'
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedProject.title.replace(/[^a-z0-9]/gi, '_')}_verslag.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccessMsg('Rapport succesvol gegenereerd en gedownload.');
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Export mislukt.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Netwerkfout bij het genereren van het rapport.');
    } finally {
      setLoading(false);
    }
  };

  const selectProject = (p) => {
    setSelectedProject(p);
    setActiveSourceId(null);
    setContextMenu(null);
    fetchProjectData(p.id);
  };

  if (selectedProject) {
    return (
      <div className="container" style={{ paddingBottom: '10rem' }}>
        <nav style={{ marginBottom: '2rem' }}>
          <button className="btn" onClick={() => setSelectedProject(null)}>← Terug naar Dashboard</button>
        </nav>

        {errorMsg && <div className="glass" style={{ background: '#450a0a', borderLeft: '4px solid #ef4444', padding: '1rem', marginBottom: '1rem' }}>{errorMsg}</div>}
        {successMsg && <div className="glass" style={{ background: '#064e3b', borderLeft: '4px solid #10b981', padding: '1rem', marginBottom: '1rem' }}>{successMsg}</div>}

        {contextMenu && (
          <div
            className="glass"
            style={{
              position: 'absolute', top: contextMenu.y, left: contextMenu.x, zIndex: 1000,
              padding: '0.5rem', background: '#1e293b', border: '1px solid var(--accent-primary)',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
            }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button className="btn" style={{ color: '#ef4444', padding: '0.4rem 1rem', width: '100%', textAlign: 'left' }} onClick={() => { handleDeleteRound(contextMenu.roundId); setContextMenu(null); }}>
              Verwijder Fase
            </button>
          </div>
        )}

        <header style={{ marginBottom: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <span className="glass" style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'uppercase', padding: '0.2rem 0.6rem' }}>Onderzoek</span>
            <h1 style={{ fontSize: '2.5rem', marginTop: '0.5rem' }}>{selectedProject.title}</h1>
            <p style={{ marginTop: '1rem', opacity: 0.8, borderLeft: '4px solid var(--accent-secondary)', paddingLeft: '1rem' }}>{selectedProject.research_question}</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleExportProject}
            disabled={loading}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', whiteSpace: 'nowrap' }}
          >
            {loading ? 'Genereren...' : '📄 Rapport Genereren (PDF)'}
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '3rem', alignItems: 'flex-start' }}>

          {/* Main Content: Rounds & Details */}
          <section>
            {activeSourceId ? (
              <div className="card glass" style={{ border: '1px solid var(--accent-primary)', position: 'relative' }}>
                <button className="btn" style={{ position: 'absolute', top: '1rem', right: '1rem' }} onClick={() => setActiveSourceId(null)}>Analyse Sluiten</button>
                <h2 style={{ marginBottom: '2rem' }}>Analyse-modus: {sources.find(s => s.id === activeSourceId)?.title || 'Bron'}</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  {/* Left Column: Extracts */}
                  <div className="glass" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>1. Informatie Vastleggen (Extractie)</h3>
                    <form onSubmit={handleAddExtract} style={{ marginBottom: '3rem' }}>
                      <div className="form-group">
                        <label>Aard van informatie</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <label><input type="radio" name="type" checked={extractForm.extract_type === 'quote'} onChange={() => setExtractForm({ ...extractForm, extract_type: 'quote' })} /> Citaat</label>
                          <label><input type="radio" name="type" checked={extractForm.extract_type === 'passage'} onChange={() => setExtractForm({ ...extractForm, extract_type: 'passage' })} /> Passage</label>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Inhoud (Letterlijk) *</label>
                        <textarea required rows="3" value={extractForm.extract_text} onChange={e => setExtractForm({ ...extractForm, extract_text: e.target.value })} placeholder="Plak hier de exacte tekst..." />
                      </div>
                      <div className="form-group">
                        <label>Context (Verplicht) *</label>
                        <textarea required rows="2" value={extractForm.context_text} onChange={e => setExtractForm({ ...extractForm, context_text: e.target.value })} placeholder="Wat stond er omheen?" />
                      </div>
                      <div className="form-group">
                        <label>Locatie (Pagina/Para) *</label>
                        <input required value={extractForm.location_ref} onChange={e => setExtractForm({ ...extractForm, location_ref: e.target.value })} placeholder="bijv. Pagina 12" />
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%', background: 'var(--accent-secondary)' }}>Vastleggen als Extract</button>
                    </form>

                    <hr style={{ opacity: 0.1, margin: '2rem 0' }} />
                    <h4>Beschikbare Extracts</h4>
                    <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                      {(extracts[activeSourceId] || []).map(ex => (
                        <div key={ex.id} className="glass" style={{ padding: '1rem', fontSize: '0.9rem' }}>
                          <blockquote style={{ margin: '0 0 0.5rem 0', borderLeft: '2px solid var(--accent-secondary)', paddingLeft: '0.5rem' }}>"{ex.extract_text}"</blockquote>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                            <button className="btn" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => useExtractAsEvidence(ex)}>Gebruik als Bewijs ↓</button>
                            <button style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem' }} onClick={() => handleDeleteExtract(ex.id)}>Verwijder</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Evidence */}
                  <div className="glass" style={{ padding: '1.5rem', border: '1px solid var(--accent-primary)' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>2. Bewijsvoering (Relevantiestelling)</h3>
                    <form onSubmit={handleAddEvidence} style={{ marginBottom: '3rem' }}>
                      <div className="form-group">
                        <label>Wat is het bewijs? *</label>
                        <textarea required rows="3" value={evidenceForm.evidence_text} onChange={e => setEvidenceForm({ ...evidenceForm, evidence_text: e.target.value })} placeholder="Geselecteerde tekst of observatie..." />
                      </div>
                      <div className="form-group">
                        <label style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>WAAROM is dit relevant? (Geen conclusie) *</label>
                        <textarea required rows="3" value={evidenceForm.why_relevant} onChange={e => setEvidenceForm({ ...evidenceForm, why_relevant: e.target.value })} placeholder="Leg uit hoe dit de onderzoeksvraag beantwoordt..." />
                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Vermijd woorden als "dus", "bewijst" of "conclusie".</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                          <label>Context *</label>
                          <input required value={evidenceForm.context_text} onChange={e => setEvidenceForm({ ...evidenceForm, context_text: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Locatie *</label>
                          <input required value={evidenceForm.location_ref} onChange={e => setEvidenceForm({ ...evidenceForm, location_ref: e.target.value })} />
                        </div>
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Bewijsstuk Formuleren</button>
                    </form>

                    <hr style={{ opacity: 0.1, margin: '2rem 0' }} />
                    <h4>Vastgelegde Bewijsvoering (Dossier)</h4>
                    <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                      {(evidence[activeSourceId] || []).map(ev => (
                        <div key={ev.id} className="glass" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
                          <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.5rem' }}>{ev.evidence_type.toUpperCase()} @ {ev.location_ref}</p>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>"{ev.evidence_text}"</strong>
                          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                            <p style={{ fontSize: '0.85rem' }}><strong>Relevantie:</strong> {ev.why_relevant}</p>
                          </div>
                          <button style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem' }} onClick={() => handleDeleteEvidence(ev.id)}>Verwijder uit dossier</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2>Onderzoeksfasen</h2>
                  <button className="btn btn-primary" onClick={() => setShowRoundForm(!showRoundForm)}>+ Nieuwe Fase</button>
                </div>

                {showRoundForm && (
                  <form onSubmit={handleCreateRound} className="card glass">
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '1rem' }}>
                      <div className="form-group"><label>Label</label><input required value={roundForm.label} onChange={e => setRoundForm({ ...roundForm, label: e.target.value })} /></div>
                      <div className="form-group"><label>Doelstelling</label><input required value={roundForm.objective} onChange={e => setRoundForm({ ...roundForm, objective: e.target.value })} /></div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Fase Starten</button>
                  </form>
                )}

                <div style={{ display: 'grid', gap: '2rem' }}>
                  {rounds.map(r => (
                    <div key={r.id} className="card glass" onContextMenu={(e) => handleContextMenu(e, r.id)} style={{ position: 'relative' }}>
                      <button
                        style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#ef4444', opacity: 0.3, cursor: 'pointer', fontSize: '0.8rem' }}
                        onClick={() => handleDeleteRound(r.id)}
                        title="Verwijder Fase"
                      >
                        Verwijder Fase
                      </button>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="glass" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-primary)', fontWeight: 800 }}>{r.label}</div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: '1.2rem' }}>{r.objective}</h3>
                          <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Gestart op {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(0,0,0,0.1)', padding: '1rem', borderRadius: '8px', marginTop: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          <input style={{ flex: 1 }} placeholder="Nieuwe zoekterm..." value={queryForm.roundId === r.id ? queryForm.text : ''} onChange={e => setQueryForm({ ...queryForm, roundId: r.id, text: e.target.value })} />
                          <input type="date" value={queryForm.roundId === r.id ? queryForm.date : ''} onChange={e => setQueryForm({ ...queryForm, roundId: r.id, date: e.target.value })} />
                          <button className="btn btn-primary" onClick={() => handleLogQuery(r.id)}>Vastleggen</button>
                        </div>
                        {(queries[r.id] || []).map(q => (
                          <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                            <span>{q.query_text}</span>
                            <span style={{ opacity: 0.4 }}>{q.executed_at}</span>
                          </div>
                        ))}
                      </div>

                      {/* Linked Sources per Round */}
                      <div style={{ marginTop: '1rem' }}>
                        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.5, marginBottom: '0.5rem' }}>Gekoppelde Bronnen</h4>
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          {(roundSources[r.id] || []).map(s => (
                            <div key={s.id} onClick={(e) => { e.stopPropagation(); setActiveSourceId(s.id); }} style={{ fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{s.title || s.url.substring(0, 30)}...</span>
                              <span style={{ opacity: 0.4 }}>{s.source_type}</span>
                            </div>
                          ))}
                          {(roundSources[r.id] || []).length === 0 && <p style={{ fontSize: '0.75rem', opacity: 0.3 }}>Nog geen bronnen gekoppeld.</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Sidebar: Source Library */}
          <aside>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem' }}>Bronbibliotheek</h2>
              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setShowSourceForm(!showSourceForm)}>Verwerven</button>
            </div>

            {showSourceForm && (
              <form onSubmit={handleAddSource} className="card glass" style={{ border: '1px solid var(--accent-primary)', padding: '1.5rem' }}>
                <h3>Bron Toevoegen</h3>
                <div className="form-group"><label>Naam (Titel) *</label><input required value={sourceForm.title} onChange={e => setSourceForm({ ...sourceForm, title: e.target.value })} placeholder="bijv. NOS Artikel over Sem" /></div>
                <div className="form-group"><label>URL *</label><input required type="url" value={sourceForm.url} onChange={e => setSourceForm({ ...sourceForm, url: e.target.value })} /></div>
                <div className="form-group"><label>Koppelen aan Fase *</label>
                  <select required value={sourceForm.roundId} onChange={e => setSourceForm({ ...sourceForm, roundId: e.target.value })}>
                    <option value="">Selecteer fase...</option>
                    {rounds.map(r => <option key={r.id} value={r.id}>{r.label}: {r.objective}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type *</label>
                  <select value={sourceForm.source_type} onChange={e => setSourceForm({ ...sourceForm, source_type: e.target.value })}>
                    <option value="article">Artikel</option><option value="video">Video</option><option value="paper">Paper</option><option value="post">Social Post</option><option value="other">Overig</option>
                  </select>
                </div>
                <div className="form-group"><label>Auteur</label><input value={sourceForm.author} onChange={e => setSourceForm({ ...sourceForm, author: e.target.value })} /></div>
                <div className="form-group"><label>Samenvatting/Notities</label><textarea rows="3" value={sourceForm.summary} onChange={e => setSourceForm({ ...sourceForm, summary: e.target.value })} /></div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Toevoegen</button>
              </form>
            )}

            <div style={{ display: 'grid', gap: '1rem' }}>
              {sources.length === 0 ? <p style={{ opacity: 0.5, textAlign: 'center' }}>Nog geen bronnen verworven.</p> : sources.map(s => (
                <div key={s.id} className={`card glass ${activeSourceId === s.id ? 'active-border' : ''}`} onClick={() => setActiveSourceId(s.id)} style={{ padding: '1rem', fontSize: '0.8rem', cursor: 'pointer', border: activeSourceId === s.id ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span className="glass" style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.7rem' }}>{s.source_type.toUpperCase()}</span>
                    <button style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', cursor: 'pointer' }} onClick={(e) => handleArchiveSource(e, s.id)}>Archiveren</button>
                  </div>
                  <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{s.title || 'Naamloze bron'}</strong>
                  <code style={{ fontSize: '0.7rem', opacity: 0.4, wordBreak: 'break-all' }}>{s.url}</code>

                  <div style={{ marginTop: '0.8rem' }} onClick={e => e.stopPropagation()}>
                    <select
                      style={{ width: '100%', fontSize: '0.7rem', padding: '0.2rem' }}
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) handleLinkSource(e.target.value, s.id); e.target.value = ""; }}
                    >
                      <option value="" disabled>+ Koppelen aan fase...</option>
                      {rounds.map(r => <option key={r.id} value={r.id}>{r.label}: {r.objective}</option>)}
                    </select>
                  </div>

                  <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{(extracts[s.id] || []).length} abstracts</span>
                    <span style={{ color: 'var(--accent-secondary)', fontSize: '0.7rem' }}>Analyseren →</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header style={{ marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Onderzoeks-Hub</h1>
        <p style={{ opacity: 0.6 }}>Research en Investigation Tool voor onderzoeksbewijs</p>
        <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={() => setShowProjectForm(!showProjectForm)}>+ Nieuw Onderzoek Starten</button>
      </header>

      {showProjectForm && (
        <form onSubmit={handleCreateProject} className="card glass" style={{ maxWidth: '600px', margin: '0 auto 3rem' }}>
          <h2>Nieuw Onderzoek</h2>
          <div className="form-group"><label>Titel</label><input required value={projectForm.title} onChange={e => setProjectForm({ ...projectForm, title: e.target.value })} /></div>
          <div className="form-group"><label>Onderzoeksvraag</label><textarea required rows="3" value={projectForm.research_question} onChange={e => setProjectForm({ ...projectForm, research_question: e.target.value })} /></div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Veilige Initialisatie</button>
        </form>
      )}

      {loading ? <p>Cloud engines worden opgewarmd...</p> : (
        <div className="project-grid">
          {projects.map(p => (
            <div key={p.id} className="card glass" onClick={() => selectProject(p)} style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <span className="glass" style={{ fontSize: '0.6rem', color: 'var(--accent-primary)' }}>ONDERZOEK #{p.id}</span>
              <h3 style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>{p.title}</h3>
              <p style={{ fontSize: '0.8rem', opacity: 0.6, fontStyle: 'italic', marginTop: '1rem' }}>"{p.research_question}"</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
