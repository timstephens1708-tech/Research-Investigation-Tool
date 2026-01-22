const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const helmet = require('helmet');
const puppeteer = require('puppeteer');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// --- Helpers & Utilities ---

// URL Normalization Logic (Block 3 v1.1 Canonical)
const normalizeUrl = (urlStr) => {
    if (!urlStr) return "";
    try {
        const trimmed = urlStr.trim();
        const url = new URL(trimmed);

        // Lowercase host
        const host = url.host.toLowerCase();

        // Remove trailing slash except for root
        let pathname = url.pathname;
        if (pathname.length > 1 && pathname.endsWith('/')) {
            pathname = pathname.slice(0, -1);
        }

        // Final construction: host + path (NO query params, NO fragments)
        return host + pathname;
    } catch (e) {
        // Fallback for non-standard formats: simple lowercasing and trim
        return urlStr.trim().toLowerCase().replace(/\/$/, '');
    }
};

// --- Block: Research (Projects) API ---

app.post('/api/projects', async (req, res) => {
    const { title, research_question, hypothesis, timespan_start, timespan_end } = req.body;
    const trimmedTitle = title?.trim();
    const trimmedQuestion = research_question?.trim();

    if (!trimmedTitle || !trimmedQuestion) {
        return res.status(400).json({ error: 'Title and Research Question are required.' });
    }

    const { data, error } = await supabase
        .from('projects')
        .insert([{ title: trimmedTitle, research_question: trimmedQuestion, hypothesis, timespan_start, timespan_end }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ id: data[0].id, message: 'Project created successfully' });
});

app.get('/api/projects', async (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    let query = supabase.from('projects').select('*');
    if (!includeArchived) query = query.eq('status', 'active');

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- Block: SearchRound API ---

app.post('/api/projects/:projectId/rounds', async (req, res) => {
    const { label, objective } = req.body;
    const { projectId } = req.params;

    const trimmedLabel = label?.trim();
    const trimmedObjective = objective?.trim();

    if (!trimmedLabel || !trimmedObjective) {
        return res.status(400).json({ error: 'Label and Objective are required.' });
    }

    const { data, error } = await supabase
        .from('search_rounds')
        .insert([{ project_id: projectId, label: trimmedLabel, objective: trimmedObjective }])
        .select();

    if (error) return res.status(error.code === '23503' ? 404 : 500).json({ error: error.message });
    res.status(201).json({ id: data[0].id, message: 'Search round created.' });
});

app.get('/api/projects/:projectId/rounds', async (req, res) => {
    const { data, error } = await supabase
        .from('search_rounds')
        .select('*')
        .eq('project_id', req.params.projectId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/rounds/:roundId', async (req, res) => {
    const { error, count } = await supabase
        .from('search_rounds')
        .delete({ count: 'exact' })
        .eq('id', req.params.roundId);

    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Round not found.' });
    res.json({ message: 'Round and associated data deleted.' });
});

// --- Block: SearchQuery API ---

app.post('/api/rounds/:roundId/queries', async (req, res) => {
    const { query_text, executed_at, notes } = req.body;
    const { roundId } = req.params;

    const trimmedQuery = query_text?.trim();
    if (!trimmedQuery || !executed_at) {
        return res.status(400).json({ error: 'Query text and executed_at are required.' });
    }

    const { data, error } = await supabase
        .from('search_queries')
        .insert([{ round_id: roundId, query_text: trimmedQuery, executed_at, notes }])
        .select();

    if (error) return res.status(error.code === '23503' ? 404 : 500).json({ error: error.message });
    res.status(201).json({ id: data[0].id, message: 'Search query logged.' });
});

app.get('/api/rounds/:roundId/queries', async (req, res) => {
    const { data, error } = await supabase
        .from('search_queries')
        .select('*')
        .eq('round_id', req.params.roundId)
        .order('executed_at', { ascending: true })
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- Block: Source (Sacred Provenance) API (v1.1) ---

// Create or Link Source
app.post('/api/projects/:projectId/sources', async (req, res) => {
    const { url, source_type, roundId, title, author, publisher, published_at, summary, notes } = req.body;
    const { projectId } = req.params;

    // Strict Validations (Rule #Validation)
    if (!url?.trim()) return res.status(400).json({ error: 'URL is required.' });
    if (!source_type) return res.status(400).json({ error: 'Source type is required.' });
    if (!roundId) return res.status(400).json({ error: 'roundId is required for creation.' });

    // Validate URL format
    try { new URL(url.trim()); } catch (e) { return res.status(400).json({ error: 'Invalid URL format.' }); }

    const normalized_url = normalizeUrl(url);

    // 1. Check for existing source record in this project
    let { data: existingSource, error: fetchErr } = await supabase
        .from('sources')
        .select('id')
        .eq('project_id', projectId)
        .eq('normalized_url', normalized_url)
        .maybeSingle();

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });

    let sourceId;
    let reused = false;

    if (existingSource) {
        sourceId = existingSource.id;
        reused = true;
    } else {
        // Create new source
        const { data: newSource, error: insertErr } = await supabase
            .from('sources')
            .insert([{
                project_id: projectId,
                url: url.trim(),
                normalized_url,
                source_type,
                title,
                author,
                publisher,
                published_at: published_at || null, // Fix: Empty string causes DB error
                summary,
                notes
            }])
            .select();

        if (insertErr) return res.status(500).json({ error: insertErr.message });
        sourceId = newSource[0].id;
    }

    // 2. Create linkage to Round (Rule #Traceability)
    console.log(`Linking Source ${sourceId} to Round ${roundId}...`);
    const { error: linkErr } = await supabase
        .from('round_sources')
        .upsert([{ round_id: parseInt(roundId), source_id: sourceId }], { onConflict: 'round_id,source_id' });

    if (linkErr) {
        console.error('Link Error:', linkErr);
        return res.status(linkErr.code === '23503' ? 404 : 500).json({ error: linkErr.message });
    }

    res.status(201).json({
        id: sourceId,
        message: reused ? 'Source linked to round.' : 'Source created and linked.',
        reused
    });
});

// List Sources for Project
app.get('/api/projects/:projectId/sources', async (req, res) => {
    const includeArchived = req.query.includeArchived === 'true';
    let query = supabase.from('sources').select('*').eq('project_id', req.params.projectId);

    if (!includeArchived) query = query.eq('is_archived', false);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Get Source Detail
app.get('/api/sources/:sourceId', async (req, res) => {
    const { data, error } = await supabase
        .from('sources')
        .select('*')
        .eq('id', req.params.sourceId)
        .single();

    if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
    res.json(data);
});

// Link Source to Round
app.post('/api/rounds/:roundId/sources/:sourceId/link', async (req, res) => {
    const { roundId, sourceId } = req.params;
    console.log(`Manual Link Request: Round ${roundId}, Source ${sourceId}`);
    const { error } = await supabase
        .from('round_sources')
        .upsert([{ round_id: parseInt(roundId), source_id: parseInt(sourceId) }], { onConflict: 'round_id,source_id' });

    if (error) {
        console.error('Manual Link Error:', error);
        return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Link created.' });
});

// Unlink Source from Round
app.delete('/api/rounds/:roundId/sources/:sourceId/link', async (req, res) => {
    const { roundId, sourceId } = req.params;
    const { error } = await supabase
        .from('round_sources')
        .delete()
        .match({ round_id: roundId, source_id: sourceId });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Link removed.' });
});

// List Sources for a specific Round
app.get('/api/rounds/:roundId/sources', async (req, res) => {
    const { roundId } = req.params;
    console.log(`Fetching sources for Round ${roundId}...`);
    const { data, error } = await supabase
        .from('round_sources')
        .select(`
            round_id,
            source_id,
            sources (*)
        `)
        .eq('round_id', roundId);

    if (error) {
        console.error('Fetch Round Sources Error:', error);
        return res.status(500).json({ error: error.message });
    }

    const sources = (data || []).map(item => item.sources).filter(Boolean);
    console.log(`Found ${sources.length} sources for Round ${roundId}`);
    res.json(sources);
});

// Archive Source (Idempotent)
app.post('/api/sources/:sourceId/archive', async (req, res) => {
    const { error } = await supabase
        .from('sources')
        .update({ is_archived: true })
        .eq('id', req.params.sourceId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Source archived.' });
});

// --- Block: Extract (Quotes & Passages) API (v1.0) ---

// Create Extract
app.post('/api/sources/:sourceId/extracts', async (req, res) => {
    const { extract_type, extract_text, context_text, location_ref } = req.body;
    const { sourceId } = req.params;

    // Strict Validations (Rule #Validation)
    const trimmedText = extract_text?.trim();
    const trimmedContext = context_text?.trim();
    const trimmedRef = location_ref?.trim();

    if (!trimmedText || !trimmedContext || !trimmedRef || !extract_type) {
        return res.status(400).json({
            error: 'Validation failed',
            details: 'extract_type, extract_text, context_text, and location_ref are all mandatory.'
        });
    }

    if (!['quote', 'passage'].includes(extract_type)) {
        return res.status(400).json({ error: 'Invalid extract_type. Must be "quote" or "passage".' });
    }

    const { data, error } = await supabase
        .from('extracts')
        .insert([{
            source_id: sourceId,
            extract_type,
            extract_text: trimmedText,
            context_text: trimmedContext,
            location_ref: trimmedRef
        }])
        .select();

    if (error) return res.status(error.code === '23503' ? 404 : 500).json({ error: error.message });
    res.status(201).json({ id: data[0].id, message: 'Extract captured successfully.' });
});

// List Extracts for Source
app.get('/api/sources/:sourceId/extracts', async (req, res) => {
    const { data, error } = await supabase
        .from('extracts')
        .select('*')
        .eq('source_id', req.params.sourceId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete Extract
app.delete('/api/extracts/:extractId', async (req, res) => {
    const { error, count } = await supabase
        .from('extracts')
        .delete({ count: 'exact' })
        .eq('id', req.params.extractId);

    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Extract not found.' });
    res.json({ message: 'Extract deleted.' });
});

// --- Block: Evidence API (v1.1) ---

// Create Evidence
app.post('/api/sources/:sourceId/evidence', async (req, res) => {
    const {
        evidence_type,
        evidence_text,
        context_text,
        location_ref,
        why_relevant,
        extract_id
    } = req.body;
    const { sourceId } = req.params;

    // Strict Validations (Rule #Validation)
    const trimmedEvidence = evidence_text?.trim();
    const trimmedContext = context_text?.trim();
    const trimmedRef = location_ref?.trim();
    const trimmedRelevant = why_relevant?.trim();

    if (!trimmedEvidence || !trimmedContext || !trimmedRef || !trimmedRelevant || !evidence_type) {
        return res.status(400).json({
            error: 'Validatie mislukt',
            details: 'evidence_type, evidence_text, context_text, location_ref en why_relevant zijn verplicht.'
        });
    }

    if (!['quote', 'passage', 'screenshot', 'note'].includes(evidence_type)) {
        return res.status(400).json({ error: 'Ongeldig evidence_type.' });
    }

    // If extract_id is provided, verify it belongs to the same source
    if (extract_id) {
        const { data: extract, error: extErr } = await supabase
            .from('extracts')
            .select('source_id')
            .eq('id', extract_id)
            .single();

        if (extErr || !extract) return res.status(400).json({ error: 'Ongeldig extract_id.' });
        if (extract.source_id.toString() !== sourceId.toString()) {
            return res.status(400).json({ error: 'Extract behoort niet tot deze bron.' });
        }
    }

    const { data, error } = await supabase
        .from('evidence')
        .insert([{
            source_id: sourceId,
            extract_id: extract_id || null,
            evidence_type,
            evidence_text: trimmedEvidence,
            context_text: trimmedContext,
            location_ref: trimmedRef,
            why_relevant: trimmedRelevant
        }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ id: data[0].id, message: 'Bewijsstuk succesvol vastgelegd.' });
});

// List Evidence for Source
app.get('/api/sources/:sourceId/evidence', async (req, res) => {
    const { data, error } = await supabase
        .from('evidence')
        .select('*')
        .eq('source_id', req.params.sourceId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Project-level aggregate view of evidence
app.get('/api/projects/:projectId/evidence', async (req, res) => {
    // This joins through sources to get evidence for a project
    const { data, error } = await supabase
        .from('evidence')
        .select('*, sources!inner(project_id)')
        .eq('sources.project_id', req.params.projectId)
        .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Delete Evidence
app.delete('/api/evidence/:evidenceId', async (req, res) => {
    const { error, count } = await supabase
        .from('evidence')
        .delete({ count: 'exact' })
        .eq('id', req.params.evidenceId);

    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Bewijsstuk niet gevonden.' });
    res.json({ message: 'Bewijsstuk verwijderd.' });
});

// --- Block: Export API (v1.1 Deterministic) ---

app.post('/api/projects/:projectId/export', async (req, res) => {
    const { projectId } = req.params;

    try {
        // 1. Fetch Project
        const { data: project, error: pErr } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (pErr || !project) return res.status(404).json({ error: 'Project niet gevonden.' });

        // 2. Aggregate Data (Deterministic Ordering)
        // Rounds
        const { data: rounds } = await supabase.from('search_rounds').select('*').eq('project_id', projectId).order('created_at', { ascending: true });

        // Queries (per Round)
        const roundsWithQueries = await Promise.all((rounds || []).map(async (r) => {
            const { data: queries } = await supabase.from('search_queries').select('*').eq('round_id', r.id).order('executed_at', { ascending: true }).order('created_at', { ascending: true });
            return { ...r, queries: queries || [] };
        }));

        // Sources
        const { data: sources } = await supabase.from('sources').select('*').eq('project_id', projectId).order('created_at', { ascending: true });

        // Evidence & Extracts (per Source)
        const sourcesWithData = await Promise.all((sources || []).map(async (s) => {
            const { data: extracts } = await supabase.from('extracts').select('*').eq('source_id', s.id).order('created_at', { ascending: true });
            const { data: evidence } = await supabase.from('evidence').select('*').eq('source_id', s.id).order('created_at', { ascending: true });
            return { ...s, extracts: extracts || [], evidence: evidence || [] };
        }));

        // 3. Build HTML Template
        const html = `
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <title>Onderzoeksverslag - ${project.title}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 2cm; }
        h1 { color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 0.5rem; margin-top: 0; }
        h2 { color: #334155; margin-top: 2rem; border-left: 4px solid #3b82f6; padding-left: 1rem; }
        h3 { color: #475569; margin-top: 1.5rem; }
        .metadata { background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; font-size: 0.9rem; }
        .round-card { background: #fff; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; page-break-inside: avoid; }
        .source-card { background: #fff; border: 1px solid #e2e8f0; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; page-break-inside: avoid; border-left: 4px solid #10b981; }
        .evidence-item { background: #eff6ff; padding: 0.8rem; border-radius: 4px; margin-top: 0.5rem; border-left: 3px solid #3b82f6; }
        .extract-item { font-style: italic; color: #64748b; font-size: 0.9rem; margin-left: 1rem; margin-top: 0.5rem; }
        .footer { position: fixed; bottom: 0; width: 100%; text-align: center; font-size: 0.7rem; color: #94a3b8; }
        code { font-family: monospace; font-size: 0.8rem; background: #f1f5f9; padding: 0.2rem; }
        @media print {
            body { margin: 1cm; font-size: 11pt; }
            .round-card, .source-card { border: 1px solid #ddd; }
        }
    </style>
</head>
<body>
    <header>
        <h1>Onderzoeksverslag</h1>
        <div class="metadata">
            <p><strong>Project:</strong> ${project.title}</p>
            <p><strong>Onderzoeksvraag:</strong> ${project.research_question}</p>
            ${project.hypothesis ? `<p><strong>Hypothese:</strong> ${project.hypothesis}</p>` : ''}
            <p><strong>Status:</strong> ${project.status.toUpperCase()}</p>
            <p><strong>Gegenereerd op:</strong> ${new Date().toLocaleString('nl-NL')}</p>
        </div>
    </header>

    <main>
        <h2>1. Onderzoeksfasen</h2>
        ${roundsWithQueries.length === 0 ? '<p>Nog geen fasen vastgelegd.</p>' : roundsWithQueries.map(r => `
            <div class="round-card">
                <h3>Fase ${r.label}: ${r.objective}</h3>
                <p><strong>Zoekopdrachten:</strong></p>
                <ul>
                    ${r.queries.length === 0 ? '<li>Geen zoekopdrachten geregistreerd voor deze fase.</li>' : r.queries.map(q => `
                        <li><code>[${q.executed_at}]</code> ${q.query_text}</li>
                    `).join('')}
                </ul>
            </div>
        `).join('')}

        <h2>2. Bronnen & Bewijsvoering</h2>
        ${sourcesWithData.length === 0 ? '<p>Nog geen bronnen verworven.</p>' : sourcesWithData.map(s => `
            <div class="source-card">
                <p><strong>BRON:</strong> ${s.title || 'Naamloze bron'}</p>
                <p style="font-size: 0.8rem;"><code>${s.url}</code></p>
                <p><strong>Type:</strong> ${s.source_type} | <strong>Auteur:</strong> ${s.author || 'Onbekend'} | <strong>Uitgever:</strong> ${s.publisher || 'Onbekend'}</p>
                
                ${s.evidence.length > 0 ? `
                    <p><strong>Bewijsvoering in Dossier:</strong></p>
                    ${s.evidence.map(ev => `
                        <div class="evidence-item">
                            <p><strong>${ev.evidence_type.toUpperCase()} @ ${ev.location_ref}:</strong> "${ev.evidence_text}"</p>
                            <p style="font-size: 0.85rem; color: #1e40af;"><strong>Relevantie:</strong> ${ev.why_relevant}</p>
                            <p style="font-size: 0.75rem; opacity: 0.6;">Context: ${ev.context_text}</p>
                        </div>
                    `).join('')}
                ` : '<p style="opacity: 0.5; font-size: 0.8rem;">Geen formele bewijsvoering geselecteerd voor deze bron.</p>'}

                ${s.extracts.length > 0 ? `
                    <details style="margin-top: 1rem; font-size: 0.8rem;">
                        <summary>Extra Extracts (${s.extracts.length})</summary>
                        ${s.extracts.map(ex => `
                            <div class="extract-item">"${ex.extract_text}" (${ex.location_ref})</div>
                        `).join('')}
                    </details>
                ` : ''}
            </div>
        `).join('')}
    </main>

    <div class="footer">
        Research Investigation Tool - AC-1.1 Gevalideerd Dossier - Vertrouwelijk
    </div>
</body>
</html>
        `;

        // 4. Render to PDF via Puppeteer
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.emulateMediaType('print');

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
        });

        await browser.close();

        // 5. Stream back
        const fileName = `${project.title.replace(/[^a-z0-9]/gi, '_')}_export.pdf`;
        res.set({
            'Content-Type': 'application/json', // Will return binary, but standard says base64 or blob handling
            'Content-Disposition': `attachment; filename="${fileName}"`
        });

        // Sending as a Buffer directly works with fetch blob()
        res.send(pdfBuffer);

    } catch (err) {
        console.error('Export Error:', err);
        res.status(500).json({ error: 'Fout bij het genereren van het rapport.', details: err.message });
    }
});

// Server Start
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Connected to Supabase: ${supabaseUrl}`);
});
