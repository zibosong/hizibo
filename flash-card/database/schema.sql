-- Flash Card Application Schema

-- Table for Card Sets
CREATE TABLE card_sets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Flashcards
CREATE TABLE flashcards (
    id SERIAL PRIMARY KEY,
    card_set_id INTEGER NOT NULL REFERENCES card_sets(id) ON DELETE CASCADE,
    front_content_type VARCHAR(10) NOT NULL CHECK (front_content_type IN ('text', 'image_url')),
    front_content TEXT NOT NULL,
    back_content_type VARCHAR(10) NOT NULL CHECK (back_content_type IN ('text', 'image_url')),
    back_content TEXT NOT NULL,
    difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for Tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

-- Join Table for Flashcards and Tags (Many-to-Many)
CREATE TABLE flashcard_tags (
    flashcard_id INTEGER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (flashcard_id, tag_id)
);

-- Indexes to improve performance
CREATE INDEX idx_flashcards_card_set_id ON flashcards(card_set_id);
CREATE INDEX idx_flashcard_tags_flashcard_id ON flashcard_tags(flashcard_id);
CREATE INDEX idx_flashcard_tags_tag_id ON flashcard_tags(tag_id);

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update 'updated_at' on table updates
CREATE TRIGGER set_timestamp_card_sets
BEFORE UPDATE ON card_sets
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_flashcards
BEFORE UPDATE ON flashcards
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp(); 