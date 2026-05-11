const { execSync } = require('child_process');

function run() {
    try {
        // Get all modified/untracked files (excluding brain/)
        const status = execSync('git status --porcelain').toString();
        const lines = status.split('\n');
        
        for (const line of lines) {
            if (!line.trim() || line.includes('brain/')) continue;
            
            // Extract filename
            // line looks like " M file.ts" or "?? newfile.ts"
            const filename = line.substring(3).trim();
            if (!filename) continue;

            console.log(`Committing: ${filename}`);
            try {
                execSync(`git add "${filename}"`);
                const msg = `Audit & Stabilization: Update ${filename} for production readiness`;
                execSync(`git commit -m "${msg}"`);
            } catch (err) {
                console.warn(`Failed to commit ${filename}: ${err.message}`);
            }
        }
        
        console.log('Pushing all commits...');
        execSync('git push origin main');
        console.log('DONE!');
    } catch (err) {
        console.error('Global Error:', err.message);
    }
}

run();
