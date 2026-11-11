const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Citation Lookup: parseCompactCitation parses various compact citation formats', async () => {
	const { parseCompactCitation } = await import('../src/citation-lookup.ts');

	// ACS / standard format with en-dash
	const p1 = parseCompactCitation('Curr. Appl Phys., 2027, 94, 40–47.');
	assert.ok(p1);
	assert.equal(p1.year, 2027);
	assert.equal(p1.volume, '94');
	assert.equal(p1.pages, '40-47');
	assert.equal(p1.firstPage, '40');
	assert.equal(p1.lastPage, '47');
	assert.equal(p1.journalText, 'Curr. Appl Phys.');

	// APS / article number format
	const p2 = parseCompactCitation('Phys. Rev. B 2021, 104, 012501');
	assert.ok(p2);
	assert.equal(p2.year, 2021);
	assert.equal(p2.volume, '104');
	assert.equal(p2.firstPage, '012501');
	assert.equal(p2.journalText, 'Phys. Rev. B');

	// Journal with issue number and range
	const p3 = parseCompactCitation('J. Am. Chem. Soc. 2023, 145(12), 6789-6800');
	assert.ok(p3);
	assert.equal(p3.year, 2023);
	assert.equal(p3.volume, '145');
	assert.equal(p3.firstPage, '6789');

	// Invalid strings return null
	assert.equal(parseCompactCitation(''), null);
	assert.equal(parseCompactCitation('Random text without any citation structure'), null);
});

test('Citation Lookup: isJournalMatch matches abbreviations and respects sub-series letters', async () => {
	const { isJournalMatch } = await import('../src/citation-lookup.ts');

	// Sub-series match
	assert.ok(isJournalMatch('Phys. Rev. B', 'Physical Review B', 'Phys. Rev. B'));
	// Sub-series conflict must be rejected
	assert.equal(isJournalMatch('Phys. Rev. B', 'Physical Review A', 'Phys. Rev. A'), false);

	// General abbreviation match
	assert.ok(isJournalMatch('Curr. Appl Phys.', 'Current Applied Physics', 'Curr. Appl. Phys.'));
	assert.ok(isJournalMatch('JACS', 'Journal of the American Chemical Society', 'J. Am. Chem. Soc.'));

	// Completely different journal
	assert.equal(isJournalMatch('Nature', 'Science', 'Sci.'), false);
});

test('Citation Lookup: verifyAndFilterCandidates filters and scores matching items', async () => {
	const { verifyAndFilterCandidates } = await import('../src/citation-lookup.ts');

	const parsed = {
		raw: 'Curr. Appl Phys., 2027, 94, 40–47.',
		journalText: 'Curr. Appl Phys.',
		year: 2027,
		volume: '94',
		firstPage: '40',
		lastPage: '47',
		pages: '40-47'
	};

	const mockItems = [
		{
			id: 101,
			isRegularItem: () => true,
			getField: (f) => {
				if (f === 'publicationTitle') return 'Current Applied Physics';
				if (f === 'journalAbbreviation') return 'Curr. Appl. Phys.';
				if (f === 'year' || f === 'date') return '2027';
				if (f === 'volume') return '94';
				if (f === 'pages') return '40-47';
				return '';
			}
		},
		{
			id: 102, // Wrong volume
			isRegularItem: () => true,
			getField: (f) => {
				if (f === 'publicationTitle') return 'Current Applied Physics';
				if (f === 'journalAbbreviation') return 'Curr. Appl. Phys.';
				if (f === 'year' || f === 'date') return '2027';
				if (f === 'volume') return '88';
				if (f === 'pages') return '10-20';
				return '';
			}
		},
		{
			id: 103, // Wrong sub-series
			isRegularItem: () => true,
			getField: (f) => {
				if (f === 'publicationTitle') return 'Applied Physics Letters';
				if (f === 'journalAbbreviation') return 'Appl. Phys. Lett.';
				if (f === 'year' || f === 'date') return '2027';
				if (f === 'volume') return '94';
				if (f === 'pages') return '40-47';
				return '';
			}
		}
	];

	const candidates = verifyAndFilterCandidates(mockItems, parsed);
	assert.equal(candidates.length, 1);
	assert.equal(candidates[0].id, 101);
});

test('Citation Lookup: parses citations with author prefix, DOI, arXiv, and AIP formats', async () => {
	const { parseCompactCitation, verifyAndFilterCandidates } = await import('../src/citation-lookup.ts');

	// Author prefix with 'et al.'
	const p1 = parseCompactCitation('Zhang et al., Curr. Appl Phys., 2027, 94, 40–47.');
	assert.ok(p1);
	assert.equal(p1.authorPrefix, 'Zhang et al.');
	assert.equal(p1.journalText, 'Curr. Appl Phys.');
	assert.equal(p1.year, 2027);

	// AIP format: [Journal] [Volume], [Page] ([Year])
	const p2 = parseCompactCitation('Appl. Phys. Lett. 120, 051102 (2022)');
	assert.ok(p2);
	assert.equal(p2.journalText, 'Appl. Phys. Lett.');
	assert.equal(p2.volume, '120');
	assert.equal(p2.firstPage, '051102');
	assert.equal(p2.year, 2022);

	// Citation with embedded DOI
	const p3 = parseCompactCitation('Nature, 2024, 628, 512-518. doi: 10.1038/s41586-024-07156-8');
	assert.ok(p3);
	assert.equal(p3.doi, '10.1038/s41586-024-07156-8');
	assert.equal(p3.year, 2024);

	// Standalone DOI lookup
	const p4 = parseCompactCitation('https://doi.org/10.1016/j.cap.2026.01.001');
	assert.ok(p4);
	assert.equal(p4.doi, '10.1016/j.cap.2026.01.001');

	// Candidate verification via DOI
	const mockDoiItem = {
		id: 201,
		isRegularItem: () => true,
		getField: (f) => f === 'DOI' ? '10.1038/s41586-024-07156-8' : ''
	};
	const matched = verifyAndFilterCandidates([mockDoiItem], p3);
	assert.equal(matched.length, 1);
	assert.equal(matched[0].id, 201);
});

test('Citation Lookup: handles numbered list prefixes, Vol./pp. prefixes, semicolons, multi-line text, and arXiv IDs', async () => {
	const { parseCompactCitation, isJournalMatch, verifyAndFilterCandidates } = await import('../src/citation-lookup.ts');

	// Numbered reference from Word/PPT with [1] and Vol./pp.
	const pNum = parseCompactCitation('[12] Curr. Appl. Phys., 2027, Vol. 94, pp. 40–47.');
	assert.ok(pNum);
	assert.equal(pNum.journalText, 'Curr. Appl. Phys.');
	assert.equal(pNum.year, 2027);
	assert.equal(pNum.volume, '94');
	assert.equal(pNum.firstPage, '40');
	assert.equal(pNum.lastPage, '47');

	// Semicolon and colon format (Vancouver / Nature style) with multiline break
	const pVan = parseCompactCitation('(3) Nature\r\n2024; 628(8008): 512-518.');
	assert.ok(pVan);
	assert.equal(pVan.journalText, 'Nature');
	assert.equal(pVan.year, 2024);
	assert.equal(pVan.volume, '628');
	assert.equal(pVan.issue, '8008');
	assert.equal(pVan.pages, '512-518');

	// Query with stopword "of" in abbreviated journal
	assert.ok(isJournalMatch('J. of Appl. Phys.', 'Journal of Applied Physics', 'J. Appl. Phys.'));

	// Standalone arXiv identifier and verification
	const pArxiv = parseCompactCitation('arXiv:2403.09876v2');
	assert.ok(pArxiv);
	assert.equal(pArxiv.arxiv, '2403.09876v2');
	const arxivItem = {
		id: 301,
		isRegularItem: () => true,
		getField: (f) => f === 'extra' ? 'arXiv:2403.09876 [cond-mat]' : ''
	};
	assert.equal(verifyAndFilterCandidates([arxivItem], pArxiv).length, 1);
});

test('Citation Lookup: supports IEEE/GB-T full references, abbreviated end pages (512-18), and author disambiguation', async () => {
	const { parseCompactCitation, verifyAndFilterCandidates } = await import('../src/citation-lookup.ts');

	// IEEE format with quoted title and vol./no./pp.
	const pIeee = parseCompactCitation('[1] J. Smith and A. Doe, "High-mobility transport in 2D materials," Appl. Phys. Lett., vol. 120, no. 5, pp. 051102, Feb. 2022.');
	assert.ok(pIeee);
	assert.equal(pIeee.journalText, 'Appl. Phys. Lett.');
	assert.equal(pIeee.volume, '120');
	assert.equal(pIeee.issue, '5');
	assert.equal(pIeee.firstPage, '051102');
	assert.equal(pIeee.year, 2022);

	// GB/T 7714 [J]. format with abbreviated end page 512-18
	const pGbt = parseCompactCitation('Wang H, Chen Y. Quantum transport in heterostructures[J]. Nature, 2024, 628: 512-18.');
	assert.ok(pGbt);
	assert.equal(pGbt.journalText, 'Nature');
	assert.equal(pGbt.year, 2024);
	assert.equal(pGbt.volume, '628');
	assert.equal(pGbt.firstPage, '512');
	assert.equal(pGbt.lastPage, '18');

	const itemA = {
		id: 401,
		isRegularItem: () => true,
		getCreators: () => [{ lastName: 'Zhang' }],
		getField: (f) => ({ publicationTitle: 'Nature', year: '2024', volume: '628', pages: '512-518', firstCreator: 'Zhang et al.' }[f] || '')
	};
	const itemB = {
		id: 402,
		isRegularItem: () => true,
		getCreators: () => [{ lastName: 'Wang' }],
		getField: (f) => ({ publicationTitle: 'Nature', year: '2024', volume: '628', pages: '512-518', firstCreator: 'Wang et al.' }[f] || '')
	};

	const matched = verifyAndFilterCandidates([itemA, itemB], pGbt);
	assert.equal(matched.length, 1);
	assert.equal(matched[0].id, 402);
});
