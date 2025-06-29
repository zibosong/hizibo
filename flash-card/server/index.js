require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.get('/', (req, res) => {
  res.send('Welcome to the Flash Card API!');
});

// --- Card Sets API Endpoints ---

// GET all card sets
app.get('/api/card-sets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM card_sets ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET a single card set by ID
app.get('/api/card-sets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM card_sets WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Card set not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// CREATE a new card set
app.post('/api/card-sets', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ msg: 'Please provide a name for the card set' });
    }
    const newCardSet = await pool.query(
      'INSERT INTO card_sets (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(newCardSet.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// UPDATE a card set
app.put('/api/card-sets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ msg: 'Please provide a name for the card set' });
    }

    const updatedCardSet = await pool.query(
      'UPDATE card_sets SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );

    if (updatedCardSet.rows.length === 0) {
      return res.status(404).json({ msg: 'Card set not found' });
    }

    res.json(updatedCardSet.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE a card set
app.delete('/api/card-sets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleteOp = await pool.query('DELETE FROM card_sets WHERE id = $1 RETURNING *', [id]);

    if (deleteOp.rowCount === 0) {
      return res.status(404).json({ msg: 'Card set not found' });
    }

    res.json({ msg: 'Card set deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- Flashcards API Endpoints ---

// GET all flashcards (optionally filter by card_set_id)
app.get('/api/flashcards', async (req, res) => {
  try {
    const { card_set_id } = req.query;
    let query = `
        SELECT f.*,
               (SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                FROM tags t
                JOIN flashcard_tags ft ON t.id = ft.tag_id
                WHERE ft.flashcard_id = f.id) as tags
        FROM flashcards f
    `;
    const queryParams = [];

    if (card_set_id) {
      query += ' WHERE f.card_set_id = $1';
      queryParams.push(card_set_id);
    }
    query += ' ORDER BY f.created_at DESC';

    const result = await pool.query(query, queryParams);
    // Ensure tags is always an array, even if null
    const rows = result.rows.map(row => ({
        ...row,
        tags: row.tags || []
    }));
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET a single flashcard by ID
app.get('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM flashcards WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ msg: 'Flashcard not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// CREATE a new flashcard
app.post('/api/flashcards', async (req, res) => {
  try {
    const { card_set_id, front_content_type, front_content, back_content_type, back_content, difficulty_level } = req.body;

    if (!card_set_id || !front_content || !back_content) {
      return res.status(400).json({ msg: 'Please provide card_set_id, front_content, and back_content' });
    }

    const newFlashcard = await pool.query(
      'INSERT INTO flashcards (card_set_id, front_content_type, front_content, back_content_type, back_content, difficulty_level) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [card_set_id, front_content_type || 'text', front_content, back_content_type || 'text', back_content, difficulty_level || 1]
    );

    res.status(201).json(newFlashcard.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// UPDATE a flashcard
app.put('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existingCardResult = await pool.query('SELECT * FROM flashcards WHERE id = $1', [id]);
    if (existingCardResult.rows.length === 0) {
      return res.status(404).json({ msg: 'Flashcard not found' });
    }
    const existingCard = existingCardResult.rows[0];

    const {
        front_content_type = existingCard.front_content_type,
        front_content = existingCard.front_content,
        back_content_type = existingCard.back_content_type,
        back_content = existingCard.back_content,
        difficulty_level = existingCard.difficulty_level
    } = req.body;

    const updatedFlashcard = await pool.query(
      'UPDATE flashcards SET front_content_type = $1, front_content = $2, back_content_type = $3, back_content = $4, difficulty_level = $5 WHERE id = $6 RETURNING *',
      [front_content_type, front_content, back_content_type, back_content, difficulty_level, id]
    );

    res.json(updatedFlashcard.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE a flashcard
app.delete('/api/flashcards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleteOp = await pool.query('DELETE FROM flashcards WHERE id = $1 RETURNING *', [id]);

    if (deleteOp.rowCount === 0) {
      return res.status(404).json({ msg: 'Flashcard not found' });
    }

    res.json({ msg: 'Flashcard deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- Tags API Endpoints ---

// GET all tags
app.get('/api/tags', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// CREATE a new tag
app.post('/api/tags', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ msg: 'Please provide a tag name' });
    }
    const newTag = await pool.query(
      'INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [name]
    );
    if (newTag.rows.length === 0) {
        const existingTag = await pool.query('SELECT * FROM tags WHERE name = $1', [name]);
        return res.status(200).json(existingTag.rows[0]);
    }
    res.status(201).json(newTag.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// --- Flashcard Tags Management ---

// GET all tags for a specific flashcard
app.get('/api/flashcards/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT t.id, t.name FROM tags t JOIN flashcard_tags ft ON t.id = ft.tag_id WHERE ft.flashcard_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});


// ADD a tag to a flashcard
app.post('/api/flashcards/:id/tags', async (req, res) => {
  try {
    const { id: flashcard_id } = req.params;
    const { tag_id } = req.body;

    if (!tag_id) {
      return res.status(400).json({ msg: 'Please provide a tag_id' });
    }

    await pool.query(
      'INSERT INTO flashcard_tags (flashcard_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [flashcard_id, tag_id]
    );

    res.status(201).json({ msg: 'Tag added to flashcard' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// REMOVE a tag from a flashcard
app.delete('/api/flashcards/:flashcard_id/tags/:tag_id', async (req, res) => {
  try {
    const { flashcard_id, tag_id } = req.params;
    await pool.query('DELETE FROM flashcard_tags WHERE flashcard_id = $1 AND tag_id = $2', [flashcard_id, tag_id]);
    res.json({ msg: 'Tag removed from flashcard' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET all flashcards for a specific tag
app.get('/api/tags/:tag_id/flashcards', async (req, res) => {
    try {
        const { tag_id } = req.params;
        const result = await pool.query(
            `SELECT f.*,
                (SELECT json_agg(t) FROM tags t JOIN flashcard_tags ft ON t.id = ft.tag_id WHERE ft.flashcard_id = f.id) as tags
            FROM flashcards f
            JOIN flashcard_tags ft ON f.id = ft.flashcard_id
            WHERE ft.tag_id = $1`,
            [tag_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 