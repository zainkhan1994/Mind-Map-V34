# Mind Map V34 - Life Node Visualization

A React TypeScript application for visualizing and organizing a hierarchical mind map of life domains with interactive collapsible nodes.

## Features

- **Visual Tree Hierarchy**: Interactive tree visualization with collapsible nodes
- **Color-Coded Categories**: Different colors for Personal (red), Health (yellow), Work (green), Projects (black), and Systems (blue)
- **Dual Modes**: 
  - Map view: Interactive mind map with collapsible nodes
  - Agenda view: Daily task list
- **Smart Filtering**: Quick filters for specific categories (Health, Work, Personal, Projects)
- **Expand/Collapse Controls**: Global and granular control over node visibility
- **Responsive Design**: Built with Tailwind CSS for responsive layout

## Project Structure

```
src/
├── main.tsx           # Application entry point
├── App.tsx            # Main app component
├── LifeMap.tsx        # Core mind map component
└── index.css          # Global styles

public/
├── index.html         # HTML entry point
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:5173`

### Build

To build for production:
```bash
npm run build
```

To preview the production build:
```bash
npm run preview
```

## Technologies Used

- **React** 18.2.0 - UI framework
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Next generation frontend build tool

## Component Overview

### LifeMap Component

The main component that renders the interactive mind map with:
- Tree data structure with parent-child relationships
- Collapsible nodes with visual indicators
- Category filtering buttons
- Toggle between Map and Agenda views

### Key Features

- **buildTree()**: Constructs hierarchical tree from flat node array
- **SquareNode**: Recursive component for rendering nodes
- **collectIds()**: Utility for flattening node hierarchies
- **State Management**: Uses React hooks for collapsed state and mode switching

## Data Structure

Nodes have the following properties:
```typescript
{
  uid: string              // Unique identifier
  id: number               // Numeric ID
  name: string             // Display name
  description: string      // Node description
  type: "folder" | "file"  // Node type
  parentUid: string | null // Parent reference
  color?: string           // Category color
}
```

## Customization

### Adding New Nodes

Edit the `rawNodes` array in `LifeMap.tsx` with your custom data structure.

### Changing Colors

Modify the `palette` object in `LifeMap.tsx` to customize color schemes:
```typescript
const palette = {
  black: "bg-black text-white border-black",
  red: "bg-red-500 text-white border-red-500",
  // ... add more colors
};
```

### Styling

All styles use Tailwind CSS classes. Modify `tailwind.config.js` to customize the theme.

## License

MIT