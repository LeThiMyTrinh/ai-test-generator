/**
 * PostmanImporter — parse Postman Collection v2.1 into test cases
 *
 * Supports:
 * - Nested folders (recursive)
 * - Request with method, URL, headers, body (raw JSON)
 * - Pre-request scripts (extract variable stores)
 * - Test scripts (extract status assertions)
 * - Collection/folder variables
 */
class PostmanImporter {
    /**
     * Parse a Postman Collection JSON (v2.1) into an array of test cases
     * @param {Object} collection - Parsed JSON of Postman collection
     * @param {string} suiteId - Target suite ID
     * @returns {{ testCases: Array, warnings: string[] }}
     */
    parse(collection, suiteId) {
        const warnings = [];

        // Validate format
        if (!collection || !collection.info) {
            throw new Error('Invalid Postman collection format. Expected v2.1 with "info" field.');
        }

        const version = collection.info.schema || '';
        if (!version.includes('v2.1') && !version.includes('v2.0')) {
            warnings.push(`Collection schema "${version}" may not be fully supported. Best with v2.1.`);
        }

        // Extract collection-level variables
        const collectionVars = this._extractVariables(collection.variable);

        // Recursively process items
        const testCases = [];
        this._processItems(collection.item || [], testCases, warnings, suiteId, collectionVars, '');

        return { testCases, warnings };
    }

    /**
     * Recursively process items (folders and requests)
     */
    _processItems(items, testCases, warnings, suiteId, variables, folderPath) {
        for (const item of items) {
            if (item.item && Array.isArray(item.item)) {
                // It's a folder — recurse
                const path = folderPath ? `${folderPath} / ${item.name}` : item.name;
                this._processItems(item.item, testCases, warnings, suiteId, variables, path);
            } else if (item.request) {
                // It's a request — convert to test case
                try {
                    const tc = this._convertRequest(item, suiteId, variables, folderPath);
                    testCases.push(tc);
                } catch (err) {
                    warnings.push(`Skipped "${item.name}": ${err.message}`);
                }
            }
        }
    }

    /**
     * Convert a single Postman request item into a test case
     */
    _convertRequest(item, suiteId, collectionVars, folderPath) {
        const req = item.request;
        const method = (typeof req.method === 'string' ? req.method : 'GET').toUpperCase();

        // Build URL
        let url = '';
        if (typeof req.url === 'string') {
            url = req.url;
        } else if (req.url && req.url.raw) {
            url = req.url.raw;
        }

        // Replace Postman {{var}} with our {{var}} format (they're the same!)
        url = this._resolvePostmanVars(url, collectionVars);

        // Build headers
        let headers = {};
        if (req.header && Array.isArray(req.header)) {
            for (const h of req.header) {
                if (!h.disabled) {
                    headers[h.key] = this._resolvePostmanVars(h.value || '', collectionVars);
                }
            }
        }

        // Build body
        let body = '';
        if (req.body) {
            if (req.body.mode === 'raw' && req.body.raw) {
                body = this._resolvePostmanVars(req.body.raw, collectionVars);
            } else if (req.body.mode === 'urlencoded' && req.body.urlencoded) {
                const obj = {};
                for (const param of req.body.urlencoded) {
                    if (!param.disabled) obj[param.key] = param.value || '';
                }
                body = JSON.stringify(obj);
                if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
            } else if (req.body.mode === 'formdata') {
                // formdata not fully supported — warn
                body = '';
            }
        }

        // Build steps
        const steps = [];
        let stepId = 1;

        // Step 1: API Request
        const apiStep = {
            step_id: stepId++,
            action: 'api_request',
            selector: method,
            value: url,
            expected: body || '',
            description: `${method} ${url}`,
        };
        if (Object.keys(headers).length > 0) {
            apiStep.headers = JSON.stringify(headers);
        }
        steps.push(apiStep);

        // Extract assertions from Postman test scripts
        const testAssertions = this._extractTestAssertions(item.event);
        for (const assertion of testAssertions) {
            steps.push({ ...assertion, step_id: stepId++ });
        }

        // If no assertions extracted, add a default status check
        if (testAssertions.length === 0) {
            steps.push({
                step_id: stepId++,
                action: 'assert_status',
                selector: '',
                value: '200',
                expected: '',
                description: 'Verify status code is 200',
            });
        }

        // Extract variable stores from pre-request/test scripts
        const varStores = this._extractVariableStores(item.event);
        for (const vs of varStores) {
            steps.push({ ...vs, step_id: stepId++ });
        }

        const title = folderPath ? `${folderPath} / ${item.name}` : item.name;

        return {
            title,
            description: item.request.description || `Imported from Postman: ${method} ${url}`,
            url: url,
            browser: 'chromium',
            suite_id: suiteId,
            steps,
        };
    }

    /**
     * Extract test assertions from Postman event scripts
     */
    _extractTestAssertions(events) {
        if (!events || !Array.isArray(events)) return [];
        const assertions = [];

        for (const event of events) {
            if (event.listen !== 'test' || !event.script || !event.script.exec) continue;
            const script = Array.isArray(event.script.exec) ? event.script.exec.join('\n') : event.script.exec;

            // pm.response.to.have.status(200)
            const statusMatch = script.match(/\.to\.have\.status\((\d+)\)/);
            if (statusMatch) {
                assertions.push({
                    action: 'assert_status',
                    selector: '',
                    value: statusMatch[1],
                    expected: '',
                    description: `Verify status ${statusMatch[1]}`,
                });
            }

            // pm.expect(pm.response.responseTime).to.be.below(500)
            const timeMatch = script.match(/responseTime.*?\.to\.be\.below\((\d+)\)/);
            if (timeMatch) {
                assertions.push({
                    action: 'assert_response_time',
                    selector: '',
                    value: timeMatch[1],
                    expected: '',
                    description: `Response time < ${timeMatch[1]}ms`,
                });
            }

            // pm.expect(jsonData.field).to.eql("value")
            const bodyMatches = script.matchAll(/pm\.expect\(.*?jsonData\.(\w[\w.]*)\)\.to\.\w+\(["']?(.+?)["']?\)/g);
            for (const m of bodyMatches) {
                assertions.push({
                    action: 'assert_body',
                    selector: `$.${m[1]}`,
                    value: '',
                    expected: m[2],
                    description: `Verify $.${m[1]} = ${m[2]}`,
                });
            }

            // Content-Type header check
            const headerMatch = script.match(/to\.have\.header\(["'](.+?)["']\)/);
            if (headerMatch) {
                assertions.push({
                    action: 'assert_header',
                    selector: headerMatch[1].toLowerCase(),
                    value: '',
                    expected: '',
                    description: `Verify header "${headerMatch[1]}" exists`,
                });
            }
        }

        return assertions;
    }

    /**
     * Extract variable stores from Postman scripts
     * Looks for: pm.environment.set("key", jsonData.path)
     */
    _extractVariableStores(events) {
        if (!events || !Array.isArray(events)) return [];
        const stores = [];

        for (const event of events) {
            if (!event.script || !event.script.exec) continue;
            const script = Array.isArray(event.script.exec) ? event.script.exec.join('\n') : event.script.exec;

            // pm.environment.set("token", jsonData.data.token)
            const setMatches = script.matchAll(/pm\.(?:environment|globals|collectionVariables)\.set\(["'](\w+)["'],\s*(?:jsonData\.)?(\S+?)\)/g);
            for (const m of setMatches) {
                const varName = m[1];
                const source = m[2].startsWith('$') ? m[2] : `$.${m[2]}`;
                stores.push({
                    action: 'store_variable',
                    selector: source,
                    value: varName,
                    expected: '',
                    description: `Store ${source} as {{${varName}}}`,
                });
            }
        }

        return stores;
    }

    /**
     * Extract variables from Postman variable array
     */
    _extractVariables(varArray) {
        if (!varArray || !Array.isArray(varArray)) return {};
        const vars = {};
        for (const v of varArray) {
            if (v.key && v.value !== undefined) {
                vars[v.key] = String(v.value);
            }
        }
        return vars;
    }

    /**
     * Replace Postman {{var}} with resolved values (or keep as {{var}} for runtime)
     */
    _resolvePostmanVars(str, variables) {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            // If it's a known collection variable, resolve it
            if (variables[key] !== undefined) return variables[key];
            // Otherwise keep as {{var}} for runtime resolution
            return match;
        });
    }
}

module.exports = PostmanImporter;
