# Semantic Search GPT Regression Tool

A web-based tool for testing and evaluating GPT model responses to semantic search queries. This tool helps identify regressions in model performance and provides visual feedback on success rates.

## Features

- **Single Question Testing**: Test individual queries with multiple iterations to evaluate consistency
- **Batch Testing**: Run multiple queries in sequence to test a variety of scenarios
- **Finder Search Integration**: Simulate integration with a company finder search tool
- **Visual Success Rate**: View success/failure rates with an interactive pie chart
- **Configuration Management**: Easily configure API keys, system prompts, and model parameters

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

#### Single Question Testing

1. Navigate to the "Single Question" tab
2. Enter your query in the text area
3. Set the number of iterations (default: 1)
4. Click "Run Test"
5. View the results and success rate chart

#### Batch Testing

1. Navigate to the "Batch Questions" tab
2. Enter multiple queries, one per line
3. Click "Run Batch Test"
4. View the results for each query

#### Finder Search

1. Navigate to the "Finder Search" tab
2. Enter a query related to company search
3. Click "Search Finder"
4. View the structured results and filter description

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