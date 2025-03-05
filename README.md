# Semantic Search GPT Regression Tool

A web-based tool for testing and evaluating GPT model responses to semantic search queries. This tool helps identify regressions in model performance and provides visual feedback on success rates.

## Features

- **Single Testing**: Run individual queries to test specific scenarios
- **Finder Search**: Test queries that generate Finder URLs and validate result counts
- **Configuration**: Customize model parameters and system prompts

## Getting Started

### Prerequisites

- An OpenAI API key
- A modern web browser

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/Eagle84/semantic-search-regression-tool.git
   ```

2. Open `semantic-search-regression-tool.html` in your web browser

3. Enter your OpenAI API key in the Configuration tab

### Usage

#### Single Testing

1. Navigate to the "Single Test" tab
2. Enter your question in the text area
3. Set the number of iterations (for consistency testing)
4. Click "Run Test"

#### Finder Search

1. Navigate to the "Finder Search" tab
2. Enter your question in the text area
3. Click "Run Finder Search"

## Configuration

In the Configuration tab, you can:

- Set your OpenAI API key
- Customize the system prompt
- Configure model parameters (model, temperature, max_tokens, etc.)

## File Structure

- `semantic-search-regression-tool.html` - Main HTML file
- `styles.css` - CSS styles
- `script.js` - JavaScript functionality

## License

This project is licensed under the MIT License - see the LICENSE file for details. 