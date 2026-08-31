/*
  StudyVault — tool data.
  Tools are defined here as plain data so search/filtering can work
  immediately on DOMContentLoaded. Render functions are referenced by
  name and resolved lazily (works with file:// and deferred scripts).
*/
/* ============ 8. Tool registry ============ */
const TOOLS = [
  {
    id: 'pdf-editor',
    name: 'PDF Editor',
    icon: '📄',
    desc: 'One workspace to merge, split, reorder, remove, compress, convert and extract text.',
    cats: ['pdf'],
    kw: 'pdf editor merge split compress convert reorder remove extract text pages zip jpg png',
    render: 'renderPdfEditor'
  },
  {
    id: 'photo-editor',
    name: 'Photo Editor',
    icon: '🖼️',
    desc: 'One workspace to rotate, flip, crop, resize, compress, convert and export images — replaces all image tools.',
    cats: ['image'],
    kw: 'photo editor image edit crop resize compress convert rotate flip duplicate zip jpg png webp',
    render: 'renderPhotoEditor'
  },

  {
    id: 'file-tools',
    name: 'File Tools',
    icon: '📁',
    desc: 'One workspace to rename, measure size, find duplicates, detect real type and export batch info for any files.',
    cats: ['file'],
    kw: 'file tools rename renamer size analyzer measure duplicate detector hash sha256 type detector magic batch info csv',
    render: 'renderFileTools'
  },

  {
    id: 'percentage-calculator',
    name: 'Percentage Calculator',
    icon: '💯',
    desc: 'Calculate your percentage from total and obtained marks.',
    cats: ['student'],
    kw: 'percentage marks grade score exam percent calculator',
    render: 'renderPercentage'
  },

  {
    id: 'gpa-calculator',
    name: 'GPA / Grade Calculator',
    icon: '🎓',
    desc: 'Calculate GPA with customizable subjects and credits.',
    cats: ['student'],
    kw: 'gpa grade cgpa average credits calculator',
    render: 'renderGpa'
  },

  {
    id: 'study-organizer',
    name: 'Study File Organizer',
    icon: '🗂️',
    desc: 'Categorize files by subject and export an organization plan.',
    cats: ['student'],
    kw: 'organize sort subjects folders physics chemistry plan',
    render: 'renderOrganizer'
  }
];

const TOOL_MAP = {};
TOOLS.forEach(t => {
  TOOL_MAP[t.id] = t;
});

const CAT_META = [
  {
    id: 'pdf',
    label: 'PDF Editor',
    icon: '📄',
    sub: 'Merge, split, compress and convert documents in one workspace.'
  },
  {
    id: 'image',
    label: 'Image Tools',
    icon: '🖼️',
    sub: 'Convert, compress, resize and crop pictures.'
  },
  {
    id: 'file',
    label: 'File Tools',
    icon: '📁',
    sub: 'Analyze, rename and understand any file.'
  },
  {
    id: 'student',
    label: 'Student Utilities',
    icon: '🎓',
    sub: 'Calculators and planners for study life.'
  }
];

