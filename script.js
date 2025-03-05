document.addEventListener('DOMContentLoaded', function() {
    // Initialize UI elements
    const apiKeyInput = document.getElementById('api-key');
    // Remove reference to the standalone system prompt
    const configTextarea = document.getElementById('configuration') || document.getElementById('config-textarea');
    const finderQuestionInput = document.getElementById('finder-question');
    
    // Chart variables
    let successChart = null;
    
    // Global variable to store location mappings
    let locationNameToIdMap = {};
    
    // Global variable to store classification mappings
    let classificationNameToIdMap = {};
    
    // Function to normalize location names for better matching
    function normalizeLocationName(name) {
        if (!name) return '';
        
        // Convert to lowercase, remove extra spaces, replace hyphens and underscores with spaces
        return name.toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[-_]/g, ' ');
    }
    
    // Function to normalize classification names for better matching
    function normalizeClassificationName(name) {
        if (!name) return '';
        
        // Convert to lowercase, remove extra spaces, replace hyphens and underscores with spaces
        return name.toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[-_]/g, ' ');
    }
    
    // Function to ensure all tab content elements exist
    function ensureTabContentElements() {
        // Check if config tab exists
        let configTab = document.getElementById('config-tab');
        if (!configTab) {
            configTab = document.createElement('div');
            configTab.id = 'config-tab';
            configTab.className = 'tab-content';
            document.querySelector('.container') || document.body.appendChild(configTab);
            
            // Create basic structure for config tab - without the system prompt section
            configTab.innerHTML = `
                <div class="input-group">
                    <label for="api-key">OpenAI API Key:</label>
                    <input type="password" id="api-key" placeholder="Enter your OpenAI API key">
                </div>
                <div class="input-group">
                    <label for="configuration">Model Configuration (JSON):</label>
                    <textarea id="configuration" rows="5" placeholder='{"model": "gpt-4o", "temperature": 0.7}'></textarea>
                </div>
                <button id="save-config" class="btn">Save Configuration</button>
            `;
            
            // Load saved API key if available
            if (localStorage.getItem('apiKey')) {
                document.getElementById('api-key').value = localStorage.getItem('apiKey');
            }
            
            // Load saved configuration if available
            if (localStorage.getItem('configuration')) {
                try {
                    const savedConfig = JSON.parse(localStorage.getItem('configuration'));
                    document.getElementById('configuration').value = JSON.stringify(savedConfig, null, 2);
                } catch (e) {
                    // Failed to parse saved configuration
                }
            }
            
            // Add event listener for save button
            document.getElementById('save-config').addEventListener('click', function() {
                const apiKey = document.getElementById('api-key').value;
                const startupSystemPrompt = document.getElementById('startup-system-prompt')?.value || '';
                const investorSystemPrompt = document.getElementById('investor-system-prompt')?.value || '';
                const configStr = document.getElementById('configuration').value;
                
                try {
                    // Validate JSON
                    JSON.parse(configStr);
                    
                    // Save to localStorage
                    localStorage.setItem('apiKey', apiKey);
                    localStorage.setItem('startupSystemPrompt', startupSystemPrompt);
                    localStorage.setItem('investorSystemPrompt', investorSystemPrompt);
                    localStorage.setItem('configuration', configStr);
                    localStorage.setItem('promptSelectionMode', getPromptSelectionMode());
                    
                    showStatus('config-status', 'Configuration saved successfully!', 'success');
                } catch (e) {
                    showStatus('config-status', 'Invalid JSON configuration', 'error');
                }
            });
        }
        
        // Check if single tab exists
        let singleTab = document.getElementById('single-tab');
        if (!singleTab) {
            singleTab = document.createElement('div');
            singleTab.id = 'single-tab';
            singleTab.className = 'tab-content active';
            document.querySelector('.container') || document.body.appendChild(singleTab);
        }
        
        // Check if batch tab exists
        let batchTab = document.getElementById('batch-tab');
        if (!batchTab) {
            batchTab = document.createElement('div');
            batchTab.id = 'batch-tab';
            batchTab.className = 'tab-content';
            document.querySelector('.container') || document.body.appendChild(batchTab);
        }
        
        // Check if finder tab exists
        let finderTab = document.getElementById('finder-tab');
        if (!finderTab) {
            finderTab = document.createElement('div');
            finderTab.id = 'finder-tab';
            finderTab.className = 'tab-content';
            document.querySelector('.container') || document.body.appendChild(finderTab);
        }
        
        // Check for status elements
        ['single-status', 'batch-status', 'finder-status', 'config-status'].forEach(id => {
            if (!document.getElementById(id)) {
                const statusElement = document.createElement('div');
                statusElement.id = id;
                statusElement.className = 'status hidden';
                const tabId = id.split('-')[0] + '-tab';
                document.getElementById(tabId)?.appendChild(statusElement);
            }
        });
    }
    
    // Ensure all tab content elements exist
    ensureTabContentElements();
    
    // Load saved values from localStorage if available
    if (localStorage.getItem('apiKey')) {
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.value = localStorage.getItem('apiKey');
        }
    }
    
    // Create startup and investor system prompts
    createSystemPromptInputs();
    
    if (localStorage.getItem('configuration')) {
        try {
            const savedConfig = JSON.parse(localStorage.getItem('configuration'));
            const configTextarea = document.getElementById('configuration') || document.getElementById('config-textarea');
            if (configTextarea) {
                configTextarea.value = JSON.stringify(savedConfig, null, 2);
            }
        } catch (e) {
            console.error('Failed to parse saved configuration:', e);
        }
    } else {
        // Set empty placeholder with example format
        const configTextarea = document.getElementById('configuration') || document.getElementById('config-textarea');
        if (configTextarea) {
            configTextarea.placeholder = '{\n  "model": "model-name",\n  "temperature": 0.7\n}';
        }
    }
    
    // Store results separately for single, batch, and finder tests
    let singleResults = [];
    let batchResults = [];
    let finderResults = [];
    
    // Tab switching
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Update active tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // Special handling for config tab
            if (tabId === 'config') {
                // Check if system prompts exist when switching to config tab
                checkAndFixSystemPromptContainers();
                
                // Hide results column when config tab is active
                const rightColumn = document.querySelector('.right-column');
                const leftColumn = document.querySelector('.left-column');
                
                if (rightColumn && leftColumn) {
                    rightColumn.style.display = 'none';
                    leftColumn.style.flexBasis = '100%';
                }
            } else {
                // Show results column for other tabs
                const rightColumn = document.querySelector('.right-column');
                const leftColumn = document.querySelector('.left-column');
                
                if (rightColumn && leftColumn) {
                    rightColumn.style.display = 'block';
                    leftColumn.style.flexBasis = '40%';
                }
                
                // Update results based on active tab
                if (tabId === 'single') {
                    displayFormattedResults(singleResults, false);
                } else if (tabId === 'batch') {
                    displayFormattedResults(batchResults, true);
                } else if (tabId === 'finder') {
                    displayFormattedResults(finderResults, false);
                }
            }
        });
    });
    
    // Save configuration
    document.getElementById('save-config').addEventListener('click', () => {
        const apiKeyInput = document.getElementById('api-key');
        const apiKey = apiKeyInput ? apiKeyInput.value : '';
        
        const startupSystemPromptInput = document.getElementById('startup-system-prompt');
        const startupSystemPrompt = startupSystemPromptInput ? startupSystemPromptInput.value : '';
        
        const investorSystemPromptInput = document.getElementById('investor-system-prompt');
        const investorSystemPrompt = investorSystemPromptInput ? investorSystemPromptInput.value : '';
        
        const configTextarea = document.getElementById('configuration') || document.getElementById('config-textarea');
        const configStr = configTextarea ? configTextarea.value : '{}';
        
        try {
            // Validate JSON
            JSON.parse(configStr);
            
            // Save to localStorage
            localStorage.setItem('apiKey', apiKey);
            localStorage.setItem('startupSystemPrompt', startupSystemPrompt);
            localStorage.setItem('investorSystemPrompt', investorSystemPrompt);
            localStorage.setItem('configuration', configStr);
            localStorage.setItem('promptSelectionMode', getPromptSelectionMode());
            
            showStatus('config-status', 'Configuration saved successfully!', 'success');
        } catch (e) {
            showStatus('config-status', 'Invalid JSON configuration', 'error');
        }
    });
    
    // Function to create system prompt inputs
    function createSystemPromptInputs() {
        // Get the container for the system prompt
        let systemPromptContainer = document.querySelector('.system-prompt-container');
        
        // If the container doesn't exist, try to find the configuration tab content
        if (!systemPromptContainer) {
            console.log('System prompt container not found, creating one');
            const configTab = document.getElementById('config-tab');
            
            if (configTab) {
                // Create a container for the system prompts if it doesn't exist
                systemPromptContainer = document.createElement('div');
                systemPromptContainer.className = 'system-prompt-container';
                
                // Find a good place to insert it - after the configuration textarea
                const configTextarea = configTab.querySelector('#configuration') || configTab.querySelector('#config-textarea');
                
                if (configTextarea && configTextarea.parentNode) {
                    // Insert after the configuration textarea's parent (likely an input-group div)
                    const parentNode = configTextarea.parentNode.parentNode || configTab;
                    parentNode.appendChild(systemPromptContainer);
                } else {
                    // If we can't find the config textarea, just append to the config tab
                    configTab.appendChild(systemPromptContainer);
                }
            } else {
                // If we can't find the config tab, create a new div and add it to the body
                console.error('Config tab not found, creating a standalone container');
                systemPromptContainer = document.createElement('div');
                systemPromptContainer.className = 'system-prompt-container';
                document.body.appendChild(systemPromptContainer);
            }
        }
        
        // Get saved startup and investor prompts
        const startupPromptValue = localStorage.getItem('startupSystemPrompt') || '';
        const investorPromptValue = localStorage.getItem('investorSystemPrompt') || '';
        
        // Get saved prompt selection mode
        const savedPromptMode = localStorage.getItem('promptSelectionMode') || 'auto';
        
        // Create the new HTML for the prompt selection UI
        const promptSelectionHTML = `
            <div class="prompt-selection-container">
                <h3>Prompt Selection</h3>
                <div class="prompt-selection-options">
                    <label>
                        <input type="radio" name="prompt-selection" value="auto" ${savedPromptMode === 'auto' ? 'checked' : ''}>
                        Auto-detect (Based on Question)
                    </label>
                    <label>
                        <input type="radio" name="prompt-selection" value="startup" ${savedPromptMode === 'startup' ? 'checked' : ''}>
                        Always Use Startup Prompt
                    </label>
                    <label>
                        <input type="radio" name="prompt-selection" value="investor" ${savedPromptMode === 'investor' ? 'checked' : ''}>
                        Always Use Investor Prompt
                    </label>
                </div>
            </div>
            
            <div class="system-prompts-container">
                <div class="startup-prompt-container">
                    <h3>Startup System Prompt</h3>
                    <textarea id="startup-system-prompt" rows="10" placeholder="Enter your startup system prompt here...">${startupPromptValue}</textarea>
                </div>
                
                <div class="investor-prompt-container">
                    <h3>Investor System Prompt</h3>
                    <textarea id="investor-system-prompt" rows="10" placeholder="Enter your investor system prompt here...">${investorPromptValue}</textarea>
                </div>
            </div>
        `;
        
        // Replace the original system prompt with the new UI
        systemPromptContainer.innerHTML = promptSelectionHTML;
        
        // Add default prompts if empty
        setTimeout(() => {
            const startupPrompt = document.getElementById('startup-system-prompt');
            const investorPrompt = document.getElementById('investor-system-prompt');
            
            if (startupPrompt && !startupPrompt.value) {
                startupPrompt.value = getDefaultStartupPrompt();
            }
            
            if (investorPrompt && !investorPrompt.value) {
                investorPrompt.value = getDefaultInvestorPrompt();
            }
        }, 100);
        
        // Make sure the container is visible
        systemPromptContainer.style.display = 'block';
        console.log('System prompt inputs created successfully');
    }
    
    // Function to get the current prompt selection mode
    function getPromptSelectionMode() {
        const selectedRadio = document.querySelector('input[name="prompt-selection"]:checked');
        return selectedRadio ? selectedRadio.value : 'auto';
    }
    
    // Function to get the appropriate system prompt based on the question
    function getSystemPromptForQuestion(question) {
        const promptMode = getPromptSelectionMode();
        
        // Add null checks before accessing value properties
        const startupPromptElement = document.getElementById('startup-system-prompt');
        const investorPromptElement = document.getElementById('investor-system-prompt');
        
        let startupPrompt = startupPromptElement ? startupPromptElement.value : getDefaultStartupPrompt();
        let investorPrompt = investorPromptElement ? investorPromptElement.value : getDefaultInvestorPrompt();
        
        // Ensure prompts are not empty
        if (!startupPrompt || startupPrompt.trim() === '') {
            console.log('Using default startup prompt because the current one is empty');
            startupPrompt = getDefaultStartupPrompt();
        }
        
        if (!investorPrompt || investorPrompt.trim() === '') {
            console.log('Using default investor prompt because the current one is empty');
            investorPrompt = getDefaultInvestorPrompt();
        }
        
        // Log which prompt is being used
        if (promptMode === 'auto') {
            const isInvestor = isInvestorQuestion(question);
            console.log(`Auto-detected question type: ${isInvestor ? 'investor' : 'startup'}`);
            return isInvestor ? investorPrompt : startupPrompt;
        } else if (promptMode === 'investor') {
            console.log('Using investor prompt based on user selection');
            return investorPrompt;
        } else {
            console.log('Using startup prompt based on user selection');
            return startupPrompt;
        }
    }
    
    // Function to determine if a question is about investors
    function isInvestorQuestion(question) {
        const investorKeywords = [
            'investor', 'investors', 'vc', 'venture capital', 'fund', 'funds', 
            'funding', 'invested', 'investing', 'investment', 'investments', 
            'portfolio', 'portfolios', 'limited partner', 'lp', 'lps', 
            'general partner', 'gp', 'gps'
        ];
        
        const questionLower = question.toLowerCase();
        return investorKeywords.some(keyword => questionLower.includes(keyword.toLowerCase()));
    }
    
    // Function to get default startup prompt
    function getDefaultStartupPrompt() {
        return `You are a language model working for a startup database company. Your role is to receive search queries or questions about startups and generate a JSON response that represents search parameters.

When asked about companies or startups, respond with:
- A JSON object containing search parameters that would best answer the user's query
- ONLY respond with the JSON object, no other text or explanation

Search parameters may include:
- sectorclassification: The industry sector (e.g., "AI", "Climate Tech", "Fintech")
- location: Geographic location(s)
- lowerFoundedYear: Startups founded after this year
- upperFoundedYear: Startups founded before this year
- alltags: Specific tags or keywords
- fundingstages: Funding stages (e.g., "Seed", "Series A")

Example:
User: "Show me AI companies founded after 2020 in Israel"
You: 
{
  "sectorclassification": "Artificial Intelligence",
  "location": "Israel",
  "lowerFoundedYear": 2020
}`;
    }
    
    // Function to get default investor prompt
    function getDefaultInvestorPrompt() {
        return `You are a language model working for an investor database company. Your role is to receive search queries or questions about investors and generate a JSON response that represents search parameters.

When asked about investors, VCs, or investment firms, respond with:
- A JSON object containing search parameters that would best answer the user's query
- ONLY respond with the JSON object, no other text or explanation

Search parameters may include:
- investorType: The type of investor (e.g., "VC", "Angel", "Corporate")
- location: Geographic location(s)
- investmentStage: Investment stages (e.g., "Seed", "Series A")
- sectorFocus: Industry sectors of interest (e.g., "AI", "Climate Tech", "Fintech")
- checkSize: Size of typical investments

Example:
User: "Find me VCs that invest in AI startups with a focus on Series A"
You: 
{
  "investorType": "VC",
  "sectorFocus": "Artificial Intelligence",
  "investmentStage": "Series A"
}`;
    }
    
    // Function to display formatted results
    function displayFormattedResults(results, isBatch = false) {
        const resultsOutput = document.getElementById('results-output');
        const resultsContainer = document.getElementById('results-container');
        const placeholder = document.getElementById('placeholder-message');
        
        if (!resultsOutput || !resultsContainer || !placeholder) {
            return;
        }
        
        // Show or hide the results and placeholder based on whether we have results
        if (results && results.length > 0) {
            resultsContainer.classList.remove('hidden');
            placeholder.style.display = 'none';
        } else {
            resultsContainer.classList.add('hidden');
            placeholder.style.display = 'flex';
            return; // No need to proceed further
        }
        
        // Format the results
        let formattedResults = '';
        
        // Check if results is an array, if not convert it to an array for consistent handling
        const resultsArray = Array.isArray(results) ? results : [results];
        
        resultsArray.forEach((result, index) => {
            // Format the output
            formattedResults += `<div class="result-item">`;
            
            // Add question and prompt type in a header section
            formattedResults += `<div class="result-header">`;
            formattedResults += `<h3>Question ${index + 1}</h3>`;
            if (result.promptType) {
                const displayType = result.promptType.charAt(0).toUpperCase() + result.promptType.slice(1);
                formattedResults += `<div class="prompt-type">${displayType}</div>`;
            }
            formattedResults += `</div>`;
            
            formattedResults += `<p class="question-text">${result.question}</p>`;
            
            // Add description separately if available
            if (result.description) {
                formattedResults += `<div class="description"><strong>Description:</strong><br>${result.description}</div>`;
            }
            
            // Format the JSON response
            if (result.jsonResponse) {
                const cleanJsonResponse = {...result.jsonResponse};
                
                // Remove description and unsupported if they were added separately
                if (cleanJsonResponse.description) {
                    delete cleanJsonResponse.description;
                }
                
                if (cleanJsonResponse.unsupported) {
                    delete cleanJsonResponse.unsupported;
                }
                
                formattedResults += `<div class="json-response"><strong>JSON Response:</strong><pre>${JSON.stringify(cleanJsonResponse, null, 2)}</pre></div>`;
            } else if (result.response) {
                // Try to extract JSON from the response if it's wrapped in markdown code blocks
                let rawResponse = result.response;
                
                if (typeof rawResponse === 'string') {
                    // Try to extract JSON if it's in code blocks
                    const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                    
                    if (jsonMatch && jsonMatch[1]) {
                        try {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            const cleanJsonData = {...jsonData};
                            
                            // Extract description and unsupported if available to display separately
                            if (jsonData.description) {
                                formattedResults += `<div class="description"><strong>Description:</strong><br>${jsonData.description}</div>`;
                            }
                            
                            if (jsonData.unsupported) {
                                formattedResults += `<p><strong>Unsupported:</strong><br>${jsonData.unsupported}</p>`;
                            }
                            
                            // Remove them from the clean JSON
                            if (cleanJsonData.description) {
                                delete cleanJsonData.description;
                            }
                            
                            if (cleanJsonData.unsupported) {
                                delete cleanJsonData.unsupported;
                            }
                            
                            // Add the clean JSON
                            formattedResults += `<div class="json-response"><strong>JSON Response:</strong><pre>${JSON.stringify(cleanJsonData, null, 2)}</pre></div>`;
                        } catch (e) {
                            formattedResults += `<p><strong>Response:</strong><br>${rawResponse}</p>`;
                        }
                    } else {
                        formattedResults += `<p><strong>Response:</strong><br>${rawResponse}</p>`;
                    }
                } else if (typeof rawResponse === 'object') {
                    // If response is already an object, format as JSON
                    const cleanResponse = {...rawResponse};
                    
                    // Remove description and unsupported if they were added separately
                    if (cleanResponse.description) {
                        delete cleanResponse.description;
                    }
                    
                    if (cleanResponse.unsupported) {
                        delete cleanResponse.unsupported;
                    }
                    
                    formattedResults += `<div class="json-response"><strong>JSON Response:</strong><pre>${JSON.stringify(cleanResponse, null, 2)}</pre></div>`;
                }
            }
            
            // Add finder results if available
            if (result.finderUrl) {
                formattedResults += `<div class="finder-results">`;
                formattedResults += `<h4>Finder Results</h4>`;
                formattedResults += `<p><strong>Finder URL:</strong> <a href="${result.finderUrl}" target="_blank" rel="noopener noreferrer">${result.finderUrl}</a></p>`;
                
                if (result.totalCompanies !== undefined) {
                    formattedResults += `<p><strong>Total ${result.entityType || 'Companies'}:</strong> ${result.totalCompanies}</p>`;
                } else if (result.retryAttempts && result.retryAttempts.length > 0) {
                    // If we have retry attempts with a successful one, use that count
                    const successfulAttempt = result.retryAttempts.find(attempt => attempt.result === "success");
                    if (successfulAttempt && successfulAttempt.count) {
                        formattedResults += `<p><strong>Total ${result.entityType || 'Companies'}:</strong> ${successfulAttempt.count}</p>`;
                    } else {
                        formattedResults += `<p><strong>Total ${result.entityType || 'Companies'}:</strong> Unknown (fetch failed)</p>`;
                    }
                } else {
                    formattedResults += `<p><strong>Total ${result.entityType || 'Companies'}:</strong> Unknown</p>`;
                }
                
                if (result.filterDescription) {
                    formattedResults += `<div class="filter-description"><strong>Filter Description:</strong><br>${result.filterDescription}</div>`;
                }
                
                if (result.message) {
                    formattedResults += `<p class="result-message ${result.totalCompanies > 0 ? 'success' : 'warning'}">${result.message}</p>`;
                }
                
                formattedResults += `</div>`;
            }
            
            formattedResults += `</div>`;
            
            // Add separator between results
            if (index < resultsArray.length - 1) {
                formattedResults += `<hr class="result-separator">`;
            }
        });
        
        // Use innerHTML to allow HTML elements like links and styling
        resultsOutput.innerHTML = formattedResults;
    }
    
    // Function to update the success rate chart
    function updateSuccessChart(successCount, failureCount, identicalResponses = false) {
        const chartContainer = document.getElementById('chart-container');
        const ctx = document.getElementById('success-chart').getContext('2d');
        
        // Destroy previous chart if it exists
        if (successChart) {
            successChart.destroy();
        }
        
        // Calculate percentages
        const total = successCount + failureCount;
        const successPercent = total > 0 ? Math.round((successCount / total) * 100) : 0;
        const failurePercent = total > 0 ? Math.round((failureCount / total) * 100) : 0;
        
        // Create labels based on whether responses are identical
        let successLabel = `Valid JSON (${successCount})`;
        let failureLabel = `Invalid JSON (${failureCount})`;
        
        if (identicalResponses && total > 1) {
            successLabel = `Valid JSON (${successCount}) - Identical`;
            failureLabel = `Invalid JSON (${failureCount}) - Identical`;
        }
        
        // Create new chart
        successChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: [successLabel, failureLabel],
                datasets: [{
                    data: [successCount, failureCount],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.7)',  // Success - green
                        'rgba(220, 53, 69, 0.7)'   // Failure - red
                    ],
                    borderColor: [
                        'rgba(40, 167, 69, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const percent = value === successCount ? successPercent : failurePercent;
                                return `${label}: ${value} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        // Show the chart container
        chartContainer.classList.remove('hidden');
    }
    
    // Function to determine if a result is successful
    function isSuccessfulResult(result) {
        // Check if the result has a valid JSON response
        if (typeof result.response === 'string') {
            const jsonMatch = result.response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const jsonData = JSON.parse(jsonMatch[1]);
                    // Consider it successful if it has at least one field other than description and unsupported
                    const keys = Object.keys(jsonData).filter(key => key !== 'description' && key !== 'unsupported');
                    return keys.length > 0;
                } catch (e) {
                    return false;
                }
            }
            return false;
        } else if (typeof result.response === 'object') {
            // If response is already an object, check if it has valid fields
            const keys = Object.keys(result.response).filter(key => key !== 'description' && key !== 'unsupported');
            return keys.length > 0;
        }
        return false;
    }
    
    // Run single test
    document.getElementById('run-single').addEventListener('click', async () => {
        const apiKeyInput = document.getElementById('api-key');
        const apiKey = apiKeyInput ? apiKeyInput.value : '';
        
        if (!apiKey) {
            showStatus('single-status', 'Please enter your OpenAI API key in the Configuration tab', 'error');
            return;
        }
        
        const configTextarea = document.getElementById('configuration') || document.getElementById('config-textarea');
        const configStr = configTextarea ? configTextarea.value : '{}';
        
        const questionInput = document.getElementById('single-question');
        const question = questionInput ? questionInput.value : '';
        
        const iterationsInput = document.getElementById('iterations');
        const iterations = iterationsInput ? parseInt(iterationsInput.value) || 1 : 1;
        
        let config;
        try {
            config = JSON.parse(configStr);
        } catch (e) {
            showStatus('single-status', 'Invalid JSON configuration in the Configuration tab', 'error');
            return;
        }
        
        showStatus('single-status', '<div class="spinner"></div> Running test...', 'info');
        
        // Clear previous results
        singleResults = [];
        displayFormattedResults(singleResults, false);
        
        try {
            let successCount = 0;
            let failureCount = 0;
            let responses = [];
            
            for (let i = 0; i < iterations; i++) {
                // Determine which prompt to use based on the question
                const promptType = isInvestorQuestion(question) ? 'investor' : 'startup';
                const systemPrompt = getSystemPromptForQuestion(question);
                
                const result = await runGptQuery(apiKey, systemPrompt, question, config);
                singleResults.push({
                    iteration: i + 1,
                    question,
                    response: result.content,
                    promptType: promptType
                });
                
                // Store response for comparison
                responses.push(result.content);
                
                // Check if the result is successful
                if (isSuccessfulResult(singleResults[singleResults.length - 1])) {
                    successCount++;
                } else {
                    failureCount++;
                }
                
                // Update results in real-time
                displayFormattedResults(singleResults, false);
                
                // Check if responses are identical
                const areIdentical = iterations > 1 && responses.every(r => r === responses[0]);
                
                // Update the chart
                updateSuccessChart(successCount, failureCount, areIdentical);
            }
            
            // Final check for identical responses
            const areAllResponsesIdentical = iterations > 1 && responses.every(r => r === responses[0]);
            
            if (areAllResponsesIdentical) {
                showStatus('single-status', 'Test completed successfully! All responses are identical.', 'success');
            } else {
                showStatus('single-status', 'Test completed successfully!', 'success');
            }
        } catch (error) {
            showStatus('single-status', `Error: ${error.message}`, 'error');
        }
    });
    
    // Run batch test
    document.getElementById('run-batch').addEventListener('click', async () => {
        const apiKeyInput = document.getElementById('api-key');
        const apiKey = apiKeyInput ? apiKeyInput.value : '';
        
        if (!apiKey) {
            showStatus('batch-status', 'Please enter your OpenAI API key in the Configuration tab', 'error');
            return;
        }
        
        const configTextarea = document.getElementById('configuration') || document.getElementById('config-textarea');
        const configStr = configTextarea ? configTextarea.value : '{}';
        
        const batchQuestionsTextarea = document.getElementById('batch-questions');
        const questionsText = batchQuestionsTextarea ? batchQuestionsTextarea.value : '';
        const questions = questionsText.split('\n').filter(q => q.trim());
        
        if (questions.length === 0) {
            showStatus('batch-status', 'Please enter at least one question', 'error');
            return;
        }
        
        let config;
        try {
            config = JSON.parse(configStr);
        } catch (e) {
            showStatus('batch-status', 'Invalid JSON configuration in the Configuration tab', 'error');
            return;
        }
        
        showStatus('batch-status', '<div class="spinner"></div> Running batch test...', 'info');
        
        // Clear previous results
        batchResults = [];
        displayFormattedResults(batchResults, true);
        
        try {
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                
                // Determine which prompt to use based on the question
                const promptType = isInvestorQuestion(question) ? 'investor' : 'startup';
                const systemPrompt = getSystemPromptForQuestion(question);
                
                const result = await runGptQuery(apiKey, systemPrompt, question, config);
                batchResults.push({
                    question,
                    response: result.content,
                    promptType: promptType
                });
                
                // Update results in real-time
                displayFormattedResults(batchResults, true);
            }
            
            showStatus('batch-status', 'Batch test completed successfully!', 'success');
        } catch (error) {
            showStatus('batch-status', `Error: ${error.message}`, 'error');
        }
    });
    
    // Add the missing event listener for the Finder Search button
    document.getElementById('run-finder').addEventListener('click', runFinderSearch);
    
    // Function to fetch company count (real HTTP request)
    async function fetchCompanyCount(url) {
        try {
            // Validate URL
            if (!url) {
                console.error("Invalid URL provided to fetchCompanyCount");
                return {
                    url: url,
                    count: 0,
                    success: false,
                    error: "Invalid URL provided"
                };
            }
            
            console.log(`Fetching count from URL via server API: ${url}`);
            
            // Call our server API instead of fetching directly
            const response = await fetch('/api/fetch-count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });
            
            if (!response.ok) {
                throw new Error(`API error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`API returned count: ${result.count}`);
                return {
                    url: url,
                    count: result.count,
                    success: true,
                    elementText: result.elementText
                };
            } else {
                console.warn(`API error: ${result.error}`);
                return {
                    url: url,
                    count: 0,
                    success: false,
                    error: result.error || 'Unknown error from API'
                };
            }
            
        } catch (error) {
            console.error("Error fetching count:", error);
            return {
                url: url,
                count: 0,
                success: false,
                error: error.message || 'Error fetching count'
            };
        }
    }
    
    // Function to show status messages
    function showStatus(elementId, message, type) {
        const statusElement = document.getElementById(elementId);
        statusElement.innerHTML = message;
        statusElement.className = `status ${type}`;
        statusElement.classList.remove('hidden');
    }

    // Simple textarea handling - no complex event listeners
    document.querySelectorAll('textarea').forEach(textarea => {
        textarea.setAttribute('spellcheck', 'false');
        textarea.setAttribute('autocomplete', 'off');
    });

    // Add CSS styles for the prompt selection UI
    function addPromptSelectionStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .prompt-selection-container {
                margin-bottom: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
                border: 1px solid #dee2e6;
            }
            
            .prompt-selection-container h3 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 16px;
                color: #495057;
            }
            
            .prompt-selection-options {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
            }
            
            .prompt-selection-options label {
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 8px 12px;
                background-color: #e9ecef;
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            
            .prompt-selection-options label:hover {
                background-color: #dee2e6;
            }
            
            .prompt-selection-options input[type="radio"] {
                margin-right: 8px;
            }
            
            .system-prompts-container {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            @media (min-width: 992px) {
                .system-prompts-container {
                    flex-direction: row;
                }
                
                .startup-prompt-container,
                .investor-prompt-container {
                    flex: 1;
                }
            }
            
            .startup-prompt-container,
            .investor-prompt-container {
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
                border: 1px solid #dee2e6;
            }
            
            .startup-prompt-container h3,
            .investor-prompt-container h3 {
                margin-top: 0;
                margin-bottom: 10px;
                font-size: 16px;
                color: #495057;
            }
            
            .startup-prompt-container textarea,
            .investor-prompt-container textarea {
                width: 100%;
                min-height: 200px;
                padding: 10px;
                font-family: monospace;
                font-size: 14px;
                line-height: 1.5;
                border: 1px solid #ced4da;
                border-radius: 4px;
                resize: vertical;
            }
        `;
        document.head.appendChild(styleElement);
    }
    
    // Call the function to add styles
    addPromptSelectionStyles();

    // Add a function to check and fix the system prompt containers
    function checkAndFixSystemPromptContainers() {
        console.log('Checking system prompt containers');
        
        // Check if the startup and investor system prompts exist
        const startupPrompt = document.getElementById('startup-system-prompt');
        const investorPrompt = document.getElementById('investor-system-prompt');
        
        if (!startupPrompt || !investorPrompt) {
            console.log('System prompt containers missing, recreating them');
            createSystemPromptInputs();
        } else {
            console.log('System prompt containers found');
        }
    }
    
    // Call the function to check and fix system prompt containers
    setTimeout(checkAndFixSystemPromptContainers, 500);

    // Add a button to manually recreate the system prompts if needed
    function addFixPromptsButton() {
        const configTab = document.getElementById('config-tab');
        if (!configTab) return;
        
        const existingButton = document.getElementById('fix-prompts-button');
        if (existingButton) return;
        
        const fixButton = document.createElement('button');
        fixButton.id = 'fix-prompts-button';
        fixButton.className = 'btn';
        fixButton.style.marginTop = '10px';
        fixButton.style.backgroundColor = '#6c757d';
        fixButton.textContent = 'Fix System Prompts';
        fixButton.addEventListener('click', function() {
            createSystemPromptInputs();
            showStatus('config-status', 'System prompts recreated', 'info');
        });
        
        // Add the button after the save button
        const saveButton = configTab.querySelector('#save-config');
        if (saveButton && saveButton.parentNode) {
            saveButton.parentNode.insertBefore(fixButton, saveButton.nextSibling);
        } else {
            configTab.appendChild(fixButton);
        }
    }
    
    // Call the function to add the fix button
    setTimeout(addFixPromptsButton, 1000);

    // Function to update debug information
    function updateDebugInfo(results) {
        const debugOutput = document.getElementById('debug-output');
        let debugContent = '';
        
        if (!debugOutput) {
            console.error('Debug output element not found');
            return;
        }
        
        // Check if results is an array or single object
        const resultsArray = Array.isArray(results) ? results : [results];
        
        resultsArray.forEach((result, index) => {
            debugContent += `<div class="debug-item">`;
            debugContent += `<h3>Debug Info for Result ${index + 1}</h3>`;
            
            // Add steps information if available
            if (result.steps && Array.isArray(result.steps)) {
                debugContent += `<div class="debug-steps">`;
                debugContent += `<h4>Process Steps:</h4>`;
                debugContent += `<ol>`;
                result.steps.forEach(step => {
                    debugContent += `<li>${typeof step === 'string' ? step : JSON.stringify(step)}</li>`;
                });
                debugContent += `</ol>`;
                debugContent += `</div>`;
            }
            
            // Add HTML preview if available
            if (result.htmlPreview) {
                debugContent += `<div class="debug-html">`;
                debugContent += `<h4>HTML Preview:</h4>`;
                debugContent += `<pre>${result.htmlPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
                debugContent += `</div>`;
            }
            
            // Add CORS error information if available
            if (result.corsError || result.corsRestricted) {
                debugContent += `<div class="debug-cors error">`;
                debugContent += `<h4>CORS Error:</h4>`;
                debugContent += `<p>${result.error || "The browser prevented access to the external URL due to CORS policy. Using simulated data instead."}</p>`;
                debugContent += `</div>`;
            }
            
            debugContent += `</div>`;
        });
        
        // Apply styling and add content
        debugContent = `
            <style>
                .debug-item { margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; border: 1px solid #ddd; }
                .debug-steps { margin-top: 10px; }
                .debug-html { margin-top: 15px; }
                .debug-html pre { background-color: #f1f1f1; padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 300px; }
                .debug-cors { margin-top: 15px; padding: 10px; border-radius: 4px; }
                .debug-cors.error { background-color: #f8d7da; color: #721c24; }
            </style>
        ` + debugContent;
        
        debugOutput.innerHTML = debugContent;
    }

    // Function for making API calls to OpenAI
    async function runGptQuery(apiKey, systemPrompt, question, config) {
        if (!apiKey) {
            throw new Error("API key is required");
        }
        
        if (!question) {
            throw new Error("Question is required");
        }
        
        // Create messages array with system prompt and user question
        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: question
            }
        ];
        
        // Get model from config or use default
        const model = config.model || "gpt-4o";
        
        // Merge other config options
        const apiConfig = {
            model: model,
            messages: messages,
            temperature: config.temperature !== undefined ? config.temperature : 0.7,
            max_tokens: config.max_tokens || 1000
        };
        
        // Add any other config parameters that were provided
        for (const key in config) {
            if (key !== 'model' && key !== 'temperature' && key !== 'max_tokens' && !apiConfig[key]) {
                apiConfig[key] = config[key];
            }
        }
        
        try {
            // Make request to OpenAI API
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(apiConfig)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData ? JSON.stringify(errorData) : 'No error details'}`);
            }
            
            const data = await response.json();
            
            if (!data.choices || data.choices.length === 0) {
                throw new Error("No response from OpenAI API");
            }
            
            const result = {
                content: data.choices[0].message.content,
                usage: data.usage,
                model: data.model,
                finish_reason: data.choices[0].finish_reason
            };
            
            return result;
        } catch (error) {
            throw new Error(`Failed to get response from OpenAI: ${error.message}`);
        }
    }

    // Function for running Finder searches
    async function runFinderSearch() {
        const apiKeyInput = document.getElementById('api-key');
        const apiKey = apiKeyInput ? apiKeyInput.value : '';
        
        if (!apiKey) {
            showStatus('finder-status', 'Please enter your OpenAI API key in the Configuration tab', 'error');
            return;
        }
        
        const configTextarea = document.getElementById('configuration') || document.getElementById('config-textarea');
        const configStr = configTextarea ? configTextarea.value : '{}';
        
        const finderQuestionInput = document.getElementById('finder-question');
        const question = finderQuestionInput ? finderQuestionInput.value : '';
        
        if (!question) {
            showStatus('finder-status', 'Please enter a question', 'error');
            return;
        }
        
        let config;
        try {
            config = JSON.parse(configStr);
        } catch (e) {
            showStatus('finder-status', 'Invalid JSON configuration in the Configuration tab', 'error');
            return;
        }
        
        showStatus('finder-status', '<div class="spinner"></div> Running search...', 'info');
        
        // Clear previous results
        finderResults = [];
        displayFormattedResults(finderResults, false);
        
        try {
            // Determine prompt type (investor or startup) based on the question
            const promptType = determinePromptType(question);
            
            // Get the appropriate system prompt based on the prompt type
            const systemPrompt = getFinderSystemPrompt(promptType);
            
            // Call OpenAI to get the JSON parameters
            const result = await runGptQuery(
                apiKey,
                systemPrompt,
                question,
                config
            );
            
            let jsonResponse = null;
            let displayJsonResponse = null; // Initialize displayJsonResponse
            let description = '';
            
            if (result && result.content) {
                // Try to extract JSON from markdown code blocks
                const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (jsonMatch && jsonMatch[1]) {
                    try {
                        jsonResponse = JSON.parse(jsonMatch[1]);
                        
                        // Extract description if available
                        if (jsonResponse.description) {
                            description = jsonResponse.description;
                            delete jsonResponse.description;
                        }
                        
                        // Extract unsupported fields if available
                        if (jsonResponse.unsupported) {
                            description += jsonResponse.unsupported ? `\n\nUnsupported fields: ${jsonResponse.unsupported}` : '';
                            delete jsonResponse.unsupported;
                        }
                        
                        // Create a deep copy of the original JSON response for display
                        displayJsonResponse = JSON.parse(JSON.stringify(jsonResponse));
                        
                        // Pre-process the JSON response to map classification names to IDs
                        if (promptType === 'investor' && jsonResponse.sectorFocus) {
                            if (Array.isArray(jsonResponse.sectorFocus)) {
                                jsonResponse.sectorFocus = jsonResponse.sectorFocus.map(sector => {
                                    const sectorId = getClassificationId(sector);
                                    console.log(`Mapped investor sector: "${sector}" -> "${sectorId}"`);
                                    return sectorId;
                                });
                            } else {
                                const sectorId = getClassificationId(jsonResponse.sectorFocus);
                                console.log(`Mapped investor sector: "${jsonResponse.sectorFocus}" -> "${sectorId}"`);
                                jsonResponse.sectorFocus = sectorId;
                            }
                        } else if (promptType === 'startup' && jsonResponse.sectorclassification) {
                            if (Array.isArray(jsonResponse.sectorclassification)) {
                                jsonResponse.sectorclassification = jsonResponse.sectorclassification.map(sector => {
                                    const sectorId = getClassificationId(sector);
                                    console.log(`Mapped startup sector: "${sector}" -> "${sectorId}"`);
                                    return sectorId;
                                });
                            } else {
                                const sectorId = getClassificationId(jsonResponse.sectorclassification);
                                console.log(`Mapped startup sector: "${jsonResponse.sectorclassification}" -> "${sectorId}"`);
                                jsonResponse.sectorclassification = sectorId;
                            }
                        }
                        
                        // Also map locations to IDs
                        if (jsonResponse.location) {
                            if (Array.isArray(jsonResponse.location)) {
                                jsonResponse.location = jsonResponse.location.map(loc => {
                                    const locationId = getLocationId(loc);
                                    console.log(`Mapped location: "${loc}" -> "${locationId}"`);
                                    return locationId;
                                });
                            } else {
                                const locationId = getLocationId(jsonResponse.location);
                                console.log(`Mapped location: "${jsonResponse.location}" -> "${locationId}"`);
                                jsonResponse.location = locationId;
                            }
                        }
                        
                        // CRITICAL FIX: Map investsectors directly if present
                        if (promptType === 'investor' && jsonResponse.investsectors) {
                            if (Array.isArray(jsonResponse.investsectors)) {
                                jsonResponse.investsectors = jsonResponse.investsectors.map(sector => {
                                    const sectorId = getClassificationId(sector);
                                    console.log(`Mapped investor investsectors: "${sector}" -> "${sectorId}"`);
                                    return sectorId;
                                });
                            } else {
                                const sectorId = getClassificationId(jsonResponse.investsectors);
                                console.log(`Mapped investor investsectors: "${jsonResponse.investsectors}" -> "${sectorId}"`);
                                jsonResponse.investsectors = sectorId;
                            }
                        }
                        
                    } catch (e) {
                        showStatus('finder-status', 'Error parsing JSON from response', 'error');
                        return;
                    }
                }
            }
            
            if (!jsonResponse) {
                showStatus('finder-status', 'Could not extract valid JSON from the GPT response', 'error');
                return;
            }
            
            // Ensure displayJsonResponse is defined
            if (!displayJsonResponse) {
                displayJsonResponse = JSON.parse(JSON.stringify(jsonResponse));
            }
            
            // Generate URL and fetch count
            showStatus('finder-status', '<div class="spinner"></div> Fetching results...', 'info');
            
            // Generate the URL directly on the client side to ensure proper mapping
            const generatedUrl = generateFinderUrlFromJsonResponse(jsonResponse, promptType);
            console.log(`Generated URL: ${generatedUrl}`);
            
            let serverResponse;
            try {
                // Call the server API with the pre-mapped JSON parameters
                const response = await fetch('/api/finder-search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonParams: jsonResponse,
                        promptType: promptType,
                        clientGeneratedUrl: generatedUrl // Send the client-generated URL to the server
                    })
                });
                
                serverResponse = await response.json();
                
                if (!response.ok) {
                    throw new Error(serverResponse.error || 'Failed to fetch results from server');
                }
                
            } catch (error) {
                showStatus('finder-status', `Error calling server API: ${error.message}`, 'error');
                
                // Create a basic totalCompaniesObj with error information
                const totalCompaniesObj = {
                    url: generatedUrl || "Error generating URL",
                    count: 0,
                    success: false,
                    error: error.message
                };
                
                // Format and display results with error
                const formattedResult = formatFinderResponseToMatchSingle(
                    displayJsonResponse, // Use the display version with original names
                    description, 
                    totalCompaniesObj, 
                    promptType
                );
                
                finderResults.push(formattedResult);
                displayFormattedResults(finderResults, false);
                return;
            }
            
            // Override the URL in the server response with our client-generated URL
            // This ensures the correct IDs are used
            serverResponse.generatedUrl = generatedUrl;
            
            // Create a totalCompaniesObj from the server response
            const totalCompaniesObj = {
                url: generatedUrl, // Use our client-generated URL
                count: serverResponse.count || 0,
                success: serverResponse.success,
                elementText: serverResponse.elementText
            };
            
            // Format and display the results
            const formattedResult = formatFinderResponseToMatchSingle(
                displayJsonResponse, // Use the display version with original names
                description, 
                totalCompaniesObj, 
                promptType
            );
            
            finderResults.push(formattedResult);
            
            // Update the UI with the results
            displayFormattedResults(finderResults, false);
            
            showStatus('finder-status', 'Search completed successfully!', 'success');
        } catch (error) {
            showStatus('finder-status', `Error: ${error.message}`, 'error');
        }
    }

    // Function to format finder response
    function formatFinderResponseToMatchSingle(searchParams, description, totalCompaniesObj, promptType) {
        // Create a formatted result object
        const result = {
            question: document.getElementById('finder-question').value,
            jsonResponse: searchParams,
            promptType: promptType,
            description: description || '',
            entityType: promptType === 'investor' ? 'Investors' : 'Companies'
        };
        
        // Add Finder URL and count information
        if (totalCompaniesObj) {
            result.finderUrl = totalCompaniesObj.url || '';
            result.totalCompanies = totalCompaniesObj.count || 0;
            result.retryAttempts = totalCompaniesObj.retryAttempts || [];
            
            if (totalCompaniesObj.steps) {
                result.steps = totalCompaniesObj.steps;
            }
            
            if (totalCompaniesObj.htmlPreview) {
                result.htmlPreview = totalCompaniesObj.htmlPreview;
            }
            
            if (totalCompaniesObj.corsError || totalCompaniesObj.corsRestricted) {
                result.corsError = true;
                result.message = "Note: Displaying simulated count due to CORS restrictions.";
            }
            
            // Generate a filter description
            result.filterDescription = generateFilterDescription(searchParams, promptType);
            
            // Add a message based on the count
            if (result.totalCompanies > 0) {
                result.message = `Found ${result.totalCompanies} ${result.entityType.toLowerCase()} matching your criteria.`;
            } else {
                result.message = `No ${result.entityType.toLowerCase()} found matching your criteria. Try broadening your search.`;
            }
        }
        
        return result;
    }
    
    // Function to generate a description of the applied filters
    function generateFilterDescription(params, promptType) {
        let description = '';
        
        if (promptType === 'investor') {
            // For investor searches
            if (params.investorType) {
                description += `Investor Type: ${Array.isArray(params.investorType) ? params.investorType.join(', ') : params.investorType}\n`;
            }
            if (params.location) {
                description += `Location: ${Array.isArray(params.location) ? params.location.join(', ') : params.location}\n`;
            }
            if (params.investmentStage) {
                description += `Investment Stage: ${Array.isArray(params.investmentStage) ? params.investmentStage.join(', ') : params.investmentStage}\n`;
            }
            if (params.sectorFocus) {
                description += `Sector Focus: ${Array.isArray(params.sectorFocus) ? params.sectorFocus.join(', ') : params.sectorFocus}\n`;
            }
            if (params.checkSize) {
                description += `Check Size: ${params.checkSize}\n`;
            }
        } else {
            // For startup searches
            if (params.sectorclassification) {
                description += `Sector: ${Array.isArray(params.sectorclassification) ? params.sectorclassification.join(', ') : params.sectorclassification}\n`;
            }
            if (params.location) {
                description += `Location: ${Array.isArray(params.location) ? params.location.join(', ') : params.location}\n`;
            }
            if (params.lowerFoundedYear || params.upperFoundedYear) {
                const lowerYear = params.lowerFoundedYear || 'any';
                const upperYear = params.upperFoundedYear || 'present';
                description += `Founded: ${lowerYear} to ${upperYear}\n`;
            }
            if (params.alltags) {
                description += `Tags: ${Array.isArray(params.alltags) ? params.alltags.join(', ') : params.alltags}\n`;
            }
            if (params.fundingstages) {
                description += `Funding Stages: ${Array.isArray(params.fundingstages) ? params.fundingstages.join(', ') : params.fundingstages}\n`;
            }
        }
        
        return description;
    }
    
    // Function to generate a Finder URL from JSON parameters
    function generateFinderUrlFromJsonResponse(jsonResponse, promptType) {
        // Default base URL for different entity types
        const baseUrl = promptType === 'investor' 
            ? 'https://qatesting.findersnc.com/investors/search'
            : 'https://qatesting.findersnc.com/startups/search';
        
        // Create URL parameters
        const params = new URLSearchParams();
        
        // Hardcoded mappings for specific classifications
        const hardcodedClassifications = {
            'Industrial Technologies': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
            'Artificial Intelligence': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Lu1rJEIDA',
            'Financial Technology': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Pv6qoEKDA'
        };
        
        // Add parameters based on entity type
        if (promptType === 'investor') {
            // Process investor-specific parameters
            if (jsonResponse.investorType) {
                if (Array.isArray(jsonResponse.investorType)) {
                    jsonResponse.investorType.forEach(type => params.append('investorType', type));
                } else {
                    params.append('investorType', jsonResponse.investorType);
                }
            }
            
            if (jsonResponse.location) {
                if (Array.isArray(jsonResponse.location)) {
                    jsonResponse.location.forEach(loc => {
                        // Map location name to ID
                        const locationId = getLocationId(loc);
                        params.append('location', locationId);
                    });
                } else {
                    // Map location name to ID
                    const locationId = getLocationId(jsonResponse.location);
                    params.append('location', locationId);
                }
            }
            
            if (jsonResponse.investmentStage) {
                if (Array.isArray(jsonResponse.investmentStage)) {
                    jsonResponse.investmentStage.forEach(stage => {
                        params.append('investmentStage', formatInvestmentStage(stage));
                    });
                } else {
                    params.append('investmentStage', formatInvestmentStage(jsonResponse.investmentStage));
                }
            }
            
            // CRITICAL FIX: Check for investsectors first (direct parameter)
            if (jsonResponse.investsectors) {
                if (Array.isArray(jsonResponse.investsectors)) {
                    jsonResponse.investsectors.forEach(sector => {
                        // The sector should already be an ID at this point, but double-check
                        if (sector.startsWith('agxzfm')) {
                            params.append('investsectors', sector);
                        } else {
                            // If somehow it's still a name, convert it
                            const sectorId = getClassificationId(sector);
                            console.log(`Final mapping for investsectors: "${sector}" -> "${sectorId}"`);
                            params.append('investsectors', sectorId);
                        }
                    });
                } else {
                    // The sector should already be an ID at this point, but double-check
                    if (jsonResponse.investsectors.startsWith('agxzfm')) {
                        params.append('investsectors', jsonResponse.investsectors);
                    } else {
                        // If somehow it's still a name, convert it
                        const sectorId = getClassificationId(jsonResponse.investsectors);
                        console.log(`Final mapping for investsectors: "${jsonResponse.investsectors}" -> "${sectorId}"`);
                        params.append('investsectors', sectorId);
                    }
                }
            }
            // Then check for sectorFocus (which gets mapped to investsectors)
            else if (jsonResponse.sectorFocus) {
                if (Array.isArray(jsonResponse.sectorFocus)) {
                    jsonResponse.sectorFocus.forEach(sector => {
                        // The sector should already be an ID at this point, but double-check
                        if (sector.startsWith('agxzfm')) {
                            params.append('investsectors', sector);
                        } else {
                            // If somehow it's still a name, convert it
                            const sectorId = getClassificationId(sector);
                            console.log(`Final mapping for sectorFocus: "${sector}" -> "${sectorId}"`);
                            params.append('investsectors', sectorId);
                        }
                    });
                } else {
                    // The sector should already be an ID at this point, but double-check
                    if (jsonResponse.sectorFocus.startsWith('agxzfm')) {
                        params.append('investsectors', jsonResponse.sectorFocus);
                    } else {
                        // If somehow it's still a name, convert it
                        const sectorId = getClassificationId(jsonResponse.sectorFocus);
                        console.log(`Final mapping for sectorFocus: "${jsonResponse.sectorFocus}" -> "${sectorId}"`);
                        params.append('investsectors', sectorId);
                    }
                }
            }
        } else {
            // Process startup-specific parameters
            if (jsonResponse.sectorclassification) {
                if (Array.isArray(jsonResponse.sectorclassification)) {
                    jsonResponse.sectorclassification.forEach(sector => {
                        // The sector should already be an ID at this point, but double-check
                        if (sector.startsWith('agxzfm')) {
                            params.append('sectorclassification', sector);
                        } else {
                            // If somehow it's still a name, convert it
                            const sectorId = getClassificationId(sector);
                            console.log(`Final mapping for sectorclassification: "${sector}" -> "${sectorId}"`);
                            params.append('sectorclassification', sectorId);
                        }
                    });
                } else {
                    // The sector should already be an ID at this point, but double-check
                    if (jsonResponse.sectorclassification.startsWith('agxzfm')) {
                        params.append('sectorclassification', jsonResponse.sectorclassification);
                    } else {
                        // If somehow it's still a name, convert it
                        const sectorId = getClassificationId(jsonResponse.sectorclassification);
                        console.log(`Final mapping for sectorclassification: "${jsonResponse.sectorclassification}" -> "${sectorId}"`);
                        params.append('sectorclassification', sectorId);
                    }
                }
            }
            
            if (jsonResponse.location) {
                if (Array.isArray(jsonResponse.location)) {
                    jsonResponse.location.forEach(loc => {
                        // Map location name to ID
                        const locationId = getLocationId(loc);
                        params.append('location', locationId);
                    });
                } else {
                    // Map location name to ID
                    const locationId = getLocationId(jsonResponse.location);
                    params.append('location', locationId);
                }
            }
            
            if (jsonResponse.lowerFoundedYear) {
                params.append('lowerFoundedYear', jsonResponse.lowerFoundedYear);
            }
            
            if (jsonResponse.upperFoundedYear) {
                params.append('upperFoundedYear', jsonResponse.upperFoundedYear);
            }
            
            if (jsonResponse.alltags) {
                if (Array.isArray(jsonResponse.alltags)) {
                    jsonResponse.alltags.forEach(tag => params.append('alltags', tag));
                } else {
                    params.append('alltags', jsonResponse.alltags);
                }
            }
            
            if (jsonResponse.fundingstages) {
                if (Array.isArray(jsonResponse.fundingstages)) {
                    jsonResponse.fundingstages.forEach(stage => params.append('fundingstages', stage));
                } else {
                    params.append('fundingstages', jsonResponse.fundingstages);
                }
            }
        }
        
        // Add common parameters
        if (jsonResponse.leadMin) {
            params.append('investleadmin', jsonResponse.leadMin);
        }
        
        // Also check for direct investleadmin parameter
        if (jsonResponse.investleadmin) {
            params.append('investleadmin', jsonResponse.investleadmin);
        }
        
        if (jsonResponse.sortBy) {
            params.append('sortBy', jsonResponse.sortBy);
        }
        
        // Handle any other direct parameters that might be in the JSON response
        // This ensures we don't miss parameters we didn't explicitly check for
        const handledParams = ['investorType', 'location', 'investmentStage', 'sectorFocus', 
                              'sectorclassification', 'lowerFoundedYear', 'upperFoundedYear', 
                              'alltags', 'fundingstages', 'leadMin', 'investleadmin', 'sortBy',
                              'description', 'unsupported', 'status', 'investsectors'];
                              
        for (const [key, value] of Object.entries(jsonResponse)) {
            // Skip parameters we've already handled
            if (handledParams.includes(key)) {
                continue;
            }
            
            if (Array.isArray(value)) {
                value.forEach(item => params.append(key, item));
            } else {
                params.append(key, value);
            }
        }
        
        // Add status=Active parameter to all URLs
        params.append('status', 'Active');
        
        // Construct the final URL
        const queryString = params.toString();
        const finalUrl = queryString ? `${baseUrl}?&${queryString}` : baseUrl;
        
        return finalUrl;
    }
    
    // Helper function to format investment stages
    function formatInvestmentStage(stage) {
        if (!stage) return stage;
        
        // If it's a single letter (A, B, C, etc.), append "Round"
        if (/^[A-Za-z]$/.test(stage)) {
            return `${stage} Round`;
        }
        
        // If it's in the format "Series X", convert to "X Round"
        if (/^Series\s+([A-Za-z])$/i.test(stage)) {
            return stage.replace(/^Series\s+([A-Za-z])$/i, '$1 Round');
        }
        
        // If it already contains "Round", leave it as is
        if (/Round/i.test(stage)) {
            return stage;
        }
        
        return stage;
    }

    // Function to determine the prompt type based on the question
    function determinePromptType(question) {
        return isInvestorQuestion(question) ? 'investor' : 'startup';
    }

    // Function to get the appropriate system prompt for finder searches
    function getFinderSystemPrompt(promptType) {
        // Add null checks before accessing value properties
        const startupPromptElement = document.getElementById('startup-system-prompt');
        const investorPromptElement = document.getElementById('investor-system-prompt');
        
        let startupPrompt = startupPromptElement ? startupPromptElement.value : getDefaultStartupPrompt();
        let investorPrompt = investorPromptElement ? investorPromptElement.value : getDefaultInvestorPrompt();
        
        // Ensure prompts are not empty
        if (!startupPrompt || startupPrompt.trim() === '') {
            console.log('Using default startup prompt because the current one is empty');
            startupPrompt = getDefaultStartupPrompt();
        }
        
        if (!investorPrompt || investorPrompt.trim() === '') {
            console.log('Using default investor prompt because the current one is empty');
            investorPrompt = getDefaultInvestorPrompt();
        }
        
        // Return the appropriate prompt based on type
        if (promptType === 'investor') {
            console.log('Using investor prompt for finder search');
            return investorPrompt;
        } else {
            console.log('Using startup prompt for finder search');
            return startupPrompt;
        }
    }

    // Function to check if the server is running
    function checkServerConnection() {
        fetch('/api/health-check')
            .then(response => {
                if (response.ok) {
                    console.log('Server connection successful');
                } else {
                    showServerWarning();
                }
            })
            .catch(error => {
                console.error('Server connection error:', error);
                showServerWarning();
            });
    }

    // Function to show server warning
    function showServerWarning() {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'server-warning';
        warningDiv.innerHTML = `
            <div class="warning-content">
                <h3>⚠️ Server Not Running</h3>
                <p>The Node.js server required for fetching accurate company counts is not running.</p>
                <p>To start the server:</p>
                <ol>
                    <li>Open a terminal/command prompt</li>
                    <li>Navigate to the project directory</li>
                    <li>Run <code>npm install</code> (first time only)</li>
                    <li>Run <code>npm run server</code></li>
                </ol>
                <p>Refer to the <code>SERVER_README.md</code> file for more details.</p>
                <button id="close-warning">Close</button>
            </div>
        `;
        
        document.body.appendChild(warningDiv);
        
        // Add style for the warning
        const style = document.createElement('style');
        style.textContent = `
            .server-warning {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: rgba(0, 0, 0, 0.7);
                z-index: 9999;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .warning-content {
                background-color: white;
                padding: 20px;
                border-radius: 5px;
                max-width: 500px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            }
            .warning-content h3 {
                color: #e74c3c;
                margin-top: 0;
            }
            .warning-content code {
                background-color: #f5f5f5;
                padding: 2px 4px;
                border-radius: 3px;
                font-family: monospace;
            }
            #close-warning {
                background-color: #3498db;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 3px;
                cursor: pointer;
                margin-top: 10px;
            }
        `;
        document.head.appendChild(style);
        
        // Add close button handler
        document.getElementById('close-warning').addEventListener('click', () => {
            warningDiv.remove();
        });
    }

    // Check server connection when page loads
    checkServerConnection();

    // Function to load and parse locations.csv to create name to ID mapping
    async function loadLocationMappings() {
        try {
            const response = await fetch('locations.csv');
            const csvText = await response.text();
            
            // Parse CSV
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(header => header.replace(/"/g, '').trim());
            
            // Find indexes for city name and city ID columns
            const cityNameIndex = headers.indexOf('city_name');
            const cityIdIndex = headers.indexOf('city_id');
            const countryNameIndex = headers.indexOf('country_name');
            const districtNameIndex = headers.indexOf('district_name');
            
            // Process each line to create mappings
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                
                const values = lines[i].split(',').map(value => value.replace(/"/g, '').trim());
                
                if (values.length <= Math.max(cityNameIndex, cityIdIndex)) continue;
                
                const cityName = values[cityNameIndex];
                const cityId = values[cityIdIndex];
                const countryName = values[countryNameIndex];
                const districtName = values[districtNameIndex];
                
                // Create composite keys for different location formats
                // Store mappings for city name alone
                locationNameToIdMap[cityName] = cityId;
                
                // Store mappings for "City, Country" format
                locationNameToIdMap[`${cityName}, ${countryName}`] = cityId;
                
                // Store mappings for "City, District, Country" format
                locationNameToIdMap[`${cityName}, ${districtName}, ${countryName}`] = cityId;
            }
            
            // Create normalized index for better matching
            locationNameToIdMap._normalizedIndex = {};
            for (const [key, value] of Object.entries(locationNameToIdMap)) {
                if (key === '_normalizedIndex') continue;
                locationNameToIdMap._normalizedIndex[normalizeLocationName(key)] = value;
            }
            
            console.log('Location mappings loaded successfully');
        } catch (error) {
            console.error('Error loading location mappings:', error);
        }
    }

    // Function to get location ID from name, returns the original name if no mapping found
    function getLocationId(locationName) {
        if (!locationName) return locationName;
        
        // Try to find exact match first
        if (locationNameToIdMap[locationName]) {
            return locationNameToIdMap[locationName];
        }
        
        // If no exact match, try normalized comparison
        const normalizedLocationName = normalizeLocationName(locationName);
        if (locationNameToIdMap._normalizedIndex && locationNameToIdMap._normalizedIndex[normalizedLocationName]) {
            return locationNameToIdMap._normalizedIndex[normalizedLocationName];
        }
        
        // If still no match, log it and return the original
        console.log(`No mapping found for location: ${locationName}`);
        return locationName;
    }

    // Call the location mapping loader when the document is ready
    loadLocationMappings();

    // Function to load classifications from CSV
    async function loadClassifications() {
        try {
            const response = await fetch('classifications.csv');
            if (!response.ok) {
                console.error('Failed to fetch classifications.csv:', response.status);
                return;
            }
            
            const csvText = await response.text();
            const lines = csvText.split('\n');
            
            // Check if headers exist
            if (lines.length === 0) {
                console.error('Classifications CSV is empty');
                return;
            }
            
            // Parse headers
            const headers = lines[0].split(',').map(header => header.replace(/"/g, '').trim());
            const idIndex = headers.indexOf('id');
            const nameIndex = headers.indexOf('name');
            
            if (idIndex === -1 || nameIndex === -1) {
                console.error('Required columns not found in classifications CSV');
                return;
            }
            
            // Clear existing mappings
            classificationNameToIdMap = {};
            
            // Process each line
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                let id, name;
                
                // Try to parse the CSV line properly
                try {
                    // Handle quoted CSV values
                    if (line.startsWith('"')) {
                        // Use regex to extract values between quotes
                        const matches = line.match(/"([^"]+)","([^"]+)"/);
                        if (matches && matches.length >= 3) {
                            id = matches[1];
                            name = matches[2];
                        }
                    } else {
                        // Simple split for unquoted values
                        const values = line.split(',');
                        if (values.length > Math.max(idIndex, nameIndex)) {
                            id = values[idIndex].trim();
                            name = values[nameIndex].trim();
                        }
                    }
                    
                    if (id && name) {
                        // Store the mapping with the original name
                        classificationNameToIdMap[name] = id;
                        
                        // Also store lowercase version
                        classificationNameToIdMap[name.toLowerCase()] = id;
                        
                        // Store version without spaces
                        classificationNameToIdMap[name.replace(/\s+/g, '')] = id;
                        classificationNameToIdMap[name.toLowerCase().replace(/\s+/g, '')] = id;
                        
                        // Store normalized version
                        const normalizedName = normalizeClassificationName(name);
                        if (!classificationNameToIdMap[normalizedName]) {
                            classificationNameToIdMap[normalizedName] = id;
                        }
                    }
                } catch (e) {
                    console.error(`Error parsing line ${i}: ${line}`, e);
                }
            }
            
            // Add common aliases manually
            const aliases = {
                'ai': 'Artificial Intelligence',
                'artificial intelligence': 'Artificial Intelligence',
                'fintech': 'Financial Technology',
                'financial technology': 'Financial Technology',
                'climate': 'Climate Tech',
                'climate tech': 'Climate Tech',
                'climatetech': 'Climate Tech',
                'healthcare': 'Health Care',
                'health care': 'Health Care',
                'healthtech': 'Health Tech',
                'health tech': 'Health Tech',
                'edtech': 'Education Technology',
                'education tech': 'Education Technology',
                'education technology': 'Education Technology',
                'industrial tech': 'Industrial Technologies',
                'industrial technology': 'Industrial Technologies',
                'industrialtech': 'Industrial Technologies',
                'industrial': 'Industrial Technologies'
            };
            
            // Add aliases to the mapping
            for (const [alias, standardName] of Object.entries(aliases)) {
                if (classificationNameToIdMap[standardName]) {
                    classificationNameToIdMap[alias] = classificationNameToIdMap[standardName];
                }
            }
            
            // Manually add specific mappings for problematic classifications
            const manualMappings = {
                'Industrial Technologies': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
                'Artificial Intelligence': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Pv6qoEKDA',
                'Financial Technology': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Pv6qoEKDA'
            };
            
            // Add manual mappings
            for (const [name, id] of Object.entries(manualMappings)) {
                classificationNameToIdMap[name] = id;
                classificationNameToIdMap[name.toLowerCase()] = id;
                classificationNameToIdMap[name.replace(/\s+/g, '')] = id;
                classificationNameToIdMap[name.toLowerCase().replace(/\s+/g, '')] = id;
            }
            
            console.log(`Loaded ${Object.keys(classificationNameToIdMap).length} classification mappings`);
        } catch (error) {
            console.error('Error loading classifications:', error);
        }
    }

    // Call the classification loader when the document is ready
    loadClassifications();

    // Function to get classification ID from name
    function getClassificationId(classificationName) {
        if (!classificationName) return classificationName;
        
        // Log the lookup attempt
        console.log(`Looking up classification: "${classificationName}"`);
        
        // Direct mapping for critical classifications
        const criticalMappings = {
            'Industrial Technologies': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
            'industrial technologies': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
            'IndustrialTechnologies': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
            'industrialtechnologies': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
            'industrial tech': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
            'Industrial Tech': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA',
            'Artificial Intelligence': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Lu1rJEIDA',
            'artificial intelligence': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Lu1rJEIDA',
            'AI': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Lu1rJEIDA',
            'ai': 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Lu1rJEIDA'
        };
        
        // Check direct critical mappings first
        if (criticalMappings[classificationName]) {
            console.log(`Found direct critical mapping for "${classificationName}": ${criticalMappings[classificationName]}`);
            return criticalMappings[classificationName];
        }
        
        // Check for direct match with original name
        if (classificationNameToIdMap[classificationName]) {
            console.log(`Found direct match for "${classificationName}": ${classificationNameToIdMap[classificationName]}`);
            return classificationNameToIdMap[classificationName];
        }
        
        // Try case-insensitive lookup
        const lowerName = classificationName.toLowerCase();
        if (classificationNameToIdMap[lowerName]) {
            console.log(`Found case-insensitive match for "${classificationName}": ${classificationNameToIdMap[lowerName]}`);
            return classificationNameToIdMap[lowerName];
        }
        
        // Try without spaces
        const noSpaceName = classificationName.replace(/\s+/g, '');
        if (classificationNameToIdMap[noSpaceName]) {
            console.log(`Found no-space match for "${classificationName}": ${classificationNameToIdMap[noSpaceName]}`);
            return classificationNameToIdMap[noSpaceName];
        }
        
        // Try lowercase without spaces
        const lowerNoSpaceName = lowerName.replace(/\s+/g, '');
        if (classificationNameToIdMap[lowerNoSpaceName]) {
            console.log(`Found lowercase no-space match for "${classificationName}": ${classificationNameToIdMap[lowerNoSpaceName]}`);
            return classificationNameToIdMap[lowerNoSpaceName];
        }
        
        // Try normalized name
        const normalizedName = normalizeClassificationName(classificationName);
        if (classificationNameToIdMap[normalizedName]) {
            console.log(`Found normalized match for "${classificationName}": ${classificationNameToIdMap[normalizedName]}`);
            return classificationNameToIdMap[normalizedName];
        }
        
        // Handle special cases for Industrial Technologies
        if (lowerName.includes('industrial') && (lowerName.includes('tech') || lowerName.includes('technolog'))) {
            const industrialTechId = 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Puanf0LDA';
            console.log(`Using hardcoded ID for Industrial Technologies: ${industrialTechId}`);
            return industrialTechId;
        }
        
        // Handle special cases for Artificial Intelligence
        if (lowerName === 'ai' || (lowerName.includes('artificial') && lowerName.includes('intellig'))) {
            const aiId = 'agxzfmlsbGlzdHNpdGVyJAsSF0Jhc2VDbGFzc2lmaWNhdGlvbk1vZGVsGICA4Lu1rJEIDA';
            console.log(`Using hardcoded ID for Artificial Intelligence: ${aiId}`);
            return aiId;
        }
        
        // If no mapping found, log it and return the original
        console.log(`No mapping found for classification: ${classificationName}`);
        return classificationName;
    }
});