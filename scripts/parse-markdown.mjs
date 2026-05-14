import fs from 'fs';

const colorMap = {
  'P — Personal': 'red',
  'H — Health': 'yellow',
  'W — Work': 'green',
  'P — Projects': 'black',
  '⚙️ Systems': 'blue',
  '📊 Data': 'purple',
};

function generateUid(name, index) {
  return `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${index}`;
}

function parseMarkdown(content) {
  const lines = content.split('\n');
  const nodes = [];
  let nodeId = 1;
  const parentStack = []; // Stack of {level, uid, name}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line.trim()) continue;
    
    // Skip table lines and other markdown
    if (line.trim().startsWith('|') || line.trim().startsWith('#') || !line.includes('-')) {
      continue;
    }

    // Only process list items starting with -
    if (!line.match(/^\s*-\s/)) continue;

    // Calculate indentation level (each level = 4 spaces typically, but can be 2)
    const leadingSpaces = line.match(/^(\s*)/)[1].length;
    const level = Math.floor(leadingSpaces / 4);
    
    // Extract content after the dash
    const match = line.match(/^\s*-\s+(.+)$/);
    if (!match) continue;
    
    let itemText = match[1].trim();
    
    // Skip table continuation
    if (itemText.startsWith('| ')) continue;
    
    // Skip pipe-only lines
    if (itemText === '|') continue;

    // Extract name and description from **name** *(description)* format
    let name = itemText;
    let description = '';
    let nodeType = 'file';

    const boldDescMatch = itemText.match(/^\*\*([^*]+)\*\*\s*\*\(([^)]+)\)\*/);
    const boldDescMatch2 = itemText.match(/^\*\*([^*]+)\*\*\s*\(([^)]+)\)/);
    const boldMatch = itemText.match(/^\*\*([^*]+)\*\*/);

    if (boldDescMatch) {
      name = boldDescMatch[1];
      description = boldDescMatch[2];
      nodeType = 'folder';
    } else if (boldDescMatch2) {
      name = boldDescMatch2[1];
      description = boldDescMatch2[2];
      nodeType = 'folder';
    } else if (boldMatch) {
      name = boldMatch[1];
      description = '';
      nodeType = 'folder';
    } else {
      // For plain text items, check for description after —
      const dashSplit = itemText.split('—');
      name = dashSplit[0].trim();
      description = dashSplit.length > 1 ? dashSplit[1].trim() : '';
    }

    // Clean up name
    name = name.replace(/\*\*/g, '').replace(/\*/g, '').trim();
    if (!name) continue;

    // Find parent
    let parentUid = null;
    
    // Pop stack to current level
    while (parentStack.length > 0 && parentStack[parentStack.length - 1].level >= level) {
      parentStack.pop();
    }
    
    // If we have items in stack, the last one is our parent
    if (parentStack.length > 0) {
      parentUid = parentStack[parentStack.length - 1].uid;
    }

    const uid = generateUid(name, nodeId);
    const color = colorMap[name];

    nodes.push({
      uid,
      id: nodeId,
      name: name.replace(/_/g, ' '),
      description,
      type: nodeType,
      parentUid,
      ...(color && { color }),
    });

    // Add to parent stack
    parentStack.push({
      level,
      uid,
      name,
    });

    nodeId++;
  }

  return nodes;
}

// Read and parse
const content = fs.readFileSync('/workspaces/Mind-Map-V34/updated.md', 'utf-8');
const nodes = parseMarkdown(content);

// Generate TypeScript code
const output = `// Auto-generated from updated.md
export const rawNodes = ${JSON.stringify(nodes, null, 2)};
`;

fs.writeFileSync('/workspaces/Mind-Map-V34/src/data.ts', output);
console.log(`Generated ${nodes.length} nodes from markdown`);
