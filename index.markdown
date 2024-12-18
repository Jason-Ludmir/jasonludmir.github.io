---
layout: null
---
<!DOCTYPE html>
<html>
<head>
  <!-- Include only the header part from your Jekyll site -->
  {% include header.html %}
  
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <style>
    /* Reset styles for this page only */
    body {
      margin: 0;
      overflow: hidden;
      background-color: #fdfdfd;
    }
    
    #bloch-sphere {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    
    .nav-label {
      position: fixed;
      color: #666;
      text-decoration: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: clamp(12px, 3vw, 16px);
      padding: 8px;
      border-radius: 5px;
      transition: color 0.3s, background-color 0.3s;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      z-index: 100;
    }
    
    .nav-label:hover {
      color: #000;
      background-color: rgba(255, 255, 255, 0.1);
    }

    /* Keep only essential header styles */
    .site-header {
      border-top: 5px solid #424242;
      border-bottom: 1px solid #e8e8e8;
      min-height: 55.95px;
      position: relative;
      z-index: 101;
      background-color: #fdfdfd;
    }
  </style>
</head>
<body>
{% include bloch-sphere.html %}
</body>
</html>

