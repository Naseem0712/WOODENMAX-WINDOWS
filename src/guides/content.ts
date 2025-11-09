interface GuideContent {
    title: string;
    html: string;
}

export const guides: Record<string, GuideContent> = {
    'index': {
        title: 'Welcome to the Guides',
        html: `
            <h2>Welcome to the WoodenMax Designer!</h2>
            <p>This guide center is here to help you get the most out of our powerful design tool. Whether you're a fabricator, architect, or contractor, these guides will walk you through the key features and help you create accurate designs and quotations quickly.</p>
            <p>Select a topic from the sidebar to get started. We cover everything from simple mirrors to complex corner windows.</p>
            <h3>What You Can Do:</h3>
            <ul>
                <li><strong>Design Complex Windows:</strong> Create multi-track sliding systems, casement windows with custom grids, and more.</li>
                <li><strong>Generate Instant Quotes:</strong> Add your designs to a professional quotation with just a few clicks.</li>
                <li><strong>Export Material Lists (BOM):</strong> Get a detailed Bill of Materials, including cutting lists for profiles, hardware quantities, and weights.</li>
                <li><strong>Customize Everything:</strong> Save your own profile series, colors, textures, and hardware to match your inventory.</li>
            </ul>
        `
    },
    'sliding': {
        title: 'Sliding Windows & Doors',
        html: `
            <h2>Design & Customize Your Sliding Windows</h2>
            <p>Create your dream sliding window design with 2-track, 3-track, 4-shutter, or 6-shutter options — all customizable as per your space. Select glass thickness, choose from clear, tinted, or frosted glass, or even upload your own texture to visualize your window before making it real.</p>
            
            <h3>How to Design Your Sliding System</h3>
            <p>The sliding window designer allows for a wide range of configurations. Here’s how to use it effectively:</p>

            <h4>1. Track & Shutter Configuration</h4>
            <p>Begin by choosing your track and shutter setup.</p>
            <ul>
                <li><strong>2-Track:</strong> Supports <strong>2-Shutter</strong> and <strong>4-Shutter</strong> configurations.</li>
                <li><strong>3-Track:</strong> Supports <strong>3-Shutter</strong> and <strong>2-Shutter + 1 Mesh</strong> configurations.</li>
            </ul>
            
            <h4>2. Fixed Shutters</h4>
            <p>You can make any shutter a fixed panel. In the "Track & Shutter Setup" section, simply check the box for each shutter you want to fix in place.</p>
            
            <h4>3. Glass & Texture</h4>
            <p>In the "Appearance" section, you can:</p>
            <ul>
                <li>Select from various <strong>glass types</strong> (Clear, Frosted, Tinted, etc.).</li>
                <li>Specify the exact <strong>glass thickness</strong> required for your project.</li>
                <li>Upload a custom <strong>texture image</strong> to visualize special glass types or finishes.</li>
            </ul>

            <h3 style="margin-top: 2.5em;">Q&A – Sliding Windows</h3>
            <dl>
                <dt><strong>Q: What are the different types of sliding windows available?</strong></dt>
                <dd>A: You can design 2-track, 3-track, 4-track, or even 6-shutter sliding windows as per your space requirement using our online sliding window maker.</dd>
                
                <dt><strong>Q: Can I choose glass type and thickness for my sliding window?</strong></dt>
                <dd>A: Yes! You can select clear, tinted, reflective, or frosted glass, and also adjust the glass thickness (4mm to 12mm) for durability and insulation.</dd>
                
                <dt><strong>Q: How can I estimate the cost of my sliding window?</strong></dt>
                <dd>A: Use our sliding window cost calculator — it provides a real-time quotation based on size, glass, and profile selection.</dd>

                <dt><strong>Q: Can I upload my own texture or color?</strong></dt>
                <dd>A: Absolutely! Our tool allows you to upload custom textures and colors to preview how your window will look after installation.</dd>
            </dl>
        `
    },
    'casement': {
        title: '🚪 Casement Windows & Doors',
        html: `
            <h2>Design Casement Windows, Doors & Foldable Systems Online</h2>
            <p>Create openable windows, single & double casement doors, fold & slide systems — all customizable with real hardware and profile options.</p>
            
            <h3>How to Design Your Casement System</h3>
            <p>This module is for creating versatile designs with fixed glass panels and openable doors (casements). You can design single windows, large multi-panel doors, and simulate more complex systems like bi-fold doors.</p>

            <h4>1. Grid Layout & Doors</h4>
            <p>Use the "Grid Layout" section to define rows and columns. Click on any panel in the grid preview to toggle it between a <strong>Fixed Panel</strong> and an <strong>Openable Door</strong>.</p>
            
            <h4>2. Simulating Advanced Designs</h4>
            <p>While direct "bi-fold" or "slide-and-fold" types are not single-click options, you can easily simulate these designs for visualization and quotation:</p>
            <ul>
                <li><strong>Bi-fold / Foldable Doors:</strong> Create a series of narrow openable doors next to each other to represent a bi-fold system.</li>
                <li><strong>Fold & Slide Systems:</strong> Combine fixed and openable panels to approximate the layout of a fold-and-slide system. The tool supports this with smooth transition previews and accurate material estimates.</li>
            </ul>

            <h4>3. Hardware Customization</h4>
            <p>In the "Handle Configuration" section, you can apply custom handles to your openable doors. The costs for hinges, locks, and other hardware are managed within your selected <strong>Profile Series</strong>, ensuring your quotation is accurate.</p>
            
            <h3 style="margin-top: 2.5em;">Q&A – Casement Windows</h3>
            <dl>
                <dt><strong>Q: What types of casement systems can I create?</strong></dt>
                <dd>A: You can design single openable windows, dual shutters, French doors, foldable casement doors, and sliding-fold combinations — all within one tool.</dd>
                
                <dt><strong>Q: Can I add handles and locks in my casement design?</strong></dt>
                <dd>A: Yes, you can apply custom handles, hinges, and hardware styles for a complete and realistic casement look. The hardware items and costs are defined in the Profile Series you select.</dd>
                
                <dt><strong>Q: Does this tool give a quotation automatically?</strong></dt>
                <dd>A: Yes, our estimator gives an accurate quotation instantly based on your glass, profile, and hardware selections.</dd>

                <dt><strong>Q: Can I design fold & slide windows?</strong></dt>
                <dd>A: Absolutely! Fold & slide windows and doors are supported. You can simulate them by creating a grid of openable doors. The tool provides a smooth transition preview and an accurate material estimate.</dd>
            </dl>
        `
    },
    'ventilator': {
        title: 'Ventilator Designs',
        html: `
            <h2>Designing Ventilators</h2>
            <p>Perfect for bathrooms and utility areas, the ventilator designer allows for highly customized layouts.</p>
            
            <h3>Panel Types</h3>
            <p>After creating a grid, click on any panel in the "Grid Layout" control panel to cycle through its type:</p>
            <ul>
                <li><strong>Glass:</strong> A standard fixed glass panel.</li>
                <li><strong>Louvers:</strong> A panel filled with profile or glass louvers. The louver blade size is defined in your Profile Series.</li>
                <li><strong>Door:</strong> An openable casement-style door within the ventilator frame.</li>
                <li><strong>Exhaust Fan:</strong> A visual representation of an exhaust fan cutout.</li>
            </ul>
        `
    },
    'glass_partition': {
        title: 'Glass Partitions',
        html: `
            <h2>Designing Glass Partitions</h2>
            <p>Create modern interior partitions with options for both framed and frameless aesthetics.</p>
            
            <h3>Panel Configuration</h3>
            <p>First, set the total number of vertical panels you need. Then, for each panel, you can cycle through its type:</p>
            <ul>
                <li><strong>Fixed:</strong> A stationary glass panel.</li>
                <li><strong>Sliding:</strong> A sliding door panel.</li>
                <li><strong>Hinged:</strong> An openable swing door.</li>
            </ul>
            
            <h3>Framed vs. Frameless</h3>
            <p>You have two levels of control over the frame:</p>
            <ol>
                <li><strong>Top/Bottom Channel:</strong> Enable or disable the main channels at the top and bottom of the entire partition for a cleaner look.</li>
                <li><strong>Panel Framing:</strong> For Fixed and Sliding panels, you can toggle individual framing on or off. Hinged doors are always framed.</li>
            </ol>
        `
    },
    'louvers': {
        title: 'Louver Systems',
        html: `
            <h2>Designing Louver Systems</h2>
            <p>This module allows you to create custom louver patterns for facades, privacy screens, and decorative elements.</p>
            
            <h3>The Pattern Editor</h3>
            <p>The core of this tool is the "Louver Pattern" editor. You build a repeating pattern by adding two types of elements:</p>
            <ul>
                <li><strong>Profile:</strong> This represents the louver blade itself. Its thickness is defined by the "Louver Profile" dimension in your selected Profile Series.</li>
                <li><strong>Gap:</strong> This represents the empty space between louver blades.</li>
            </ul>
            <p>You can add, remove, and reorder these items and set a custom size for each to create unique, non-uniform louver designs. The tool will repeat this pattern across the entire width or height of your design.</p>
        `
    },
    'corner': {
        title: 'Corner (L-Type) Windows',
        html: `
            <h2>Designing Corner Windows</h2>
            <p>Create seamless L-shaped window configurations that wrap around corners.</p>
            
            <h3>How It Works</h3>
            <ol>
                <li><strong>Set Dimensions:</strong> Enter the width of the <strong>Left Wall</strong> and <strong>Right Wall</strong>, along with the width of the <strong>Corner Post</strong> that joins them.</li>
                <li><strong>Configure Each Side:</strong> Use the "Left Wall" and "Right Wall" tabs to switch between the two sides.</li>
                <li><strong>Choose a Type:</strong> For each side, you can independently choose to create a <strong>Sliding</strong>, <strong>Casement/Fixed</strong>, or <strong>Ventilator</strong> system. All the controls for that window type will become available for the selected side.</li>
            </ol>
            <p>This allows you to combine different window types, for example, a fixed casement window on one wall and a sliding window on the other.</p>
        `
    },
    'mirror': {
        title: 'Mirror Design & Visualization',
        html: `
            <h2>Designing Custom Mirrors</h2>
            <p>Quickly design and visualize mirrors in various shapes and styles.</p>
            
            <h3>Shape Options</h3>
            <p>You can choose from several popular shapes:</p>
            <ul>
                <li><strong>Rectangle</strong></li>
                <li><strong>Rounded Rectangle:</strong> Allows you to specify a custom corner radius.</li>
                <li><strong>Capsule</strong></li>
                <li><strong>Oval</strong></li>
            </ul>
            
            <h3>Framed vs. Frameless</h3>
            <p>Use the "Frameless Design" checkbox to toggle the profile frame on or off. When a frame is enabled, its thickness is controlled by the <strong>Outer Frame</strong> dimension in the selected "Profile Series". This allows you to visualize the final product accurately.</p>
        `
    },
    'georgian_bars': {
        title: 'Georgian Bars (Decorative Grids)',
        html: `
            <h2>Using Georgian Bars</h2>
            <p>Georgian bars are a decorative grid applied over or inside a glass panel to give it a classic, luxury look of divided lites.</p>
            
            <h3>How to Apply</h3>
            <p>The "Georgian Bars" control panel is available for most window types that use glass.</p>
            <ol>
                <li><strong>Set Bar Thickness:</strong> Define the width of the grid bars.</li>
                <li><strong>Configure Pattern:</strong> For both Horizontal and Vertical bars, you can set:
                    <ul>
                        <li><strong>Count:</strong> The number of bars.</li>
                        <li><strong>Offset:</strong> The distance from the edge to the first bar.</li>
                        <li><strong>Gap:</strong> The distance between subsequent bars.</li>
                    </ul>
                </li>
                <li><strong>Apply to All or Individually:</strong> By default, the pattern applies to all glass panels in the design. You can uncheck "Apply to all panels" to select and configure a unique grid for each individual panel.</li>
            </ol>
        `
    },
    'qna': {
        title: 'Q&A and FAQ',
        html: `
            <h2>Frequently Asked Questions</h2>
            
            <h3>What is the WoodenMax Design Tool?</h3>
            <p>This is a powerful, <strong>free online tool</strong> for designing custom architectural elements like aluminium/uPVC windows, doors, and partitions. It serves as an all-in-one <strong>window design tool</strong> and <strong>quotation software</strong>.</p>
            
            <h3>Who is this tool for?</h3>
            <p>It's designed for professionals in the construction and design industry, including <strong>fabricators, architects, contractors, and builders</strong>. It helps streamline the design-to-quote process, reducing errors and saving time.</p>
            
            <h3>Can I generate a cutting list for fabrication?</h3>
            <p>Yes. The tool functions as a <strong>window cutting list software</strong>. After adding items to your quotation, open the "View Quotation" modal and click on "Export Materials (BOM)". This summary details all required profile lengths, hardware quantities, and weights, making it an essential <strong>aluminium window calculator</strong> for production.</p>

            <h3>How do I save my custom profiles?</h3>
            <p>In the "Profile Series" section, you can adjust the dimensions of any standard profile. Once you're happy with the dimensions, click "Save as New...", give it a unique name, and it will be saved to your browser for future use.</p>

            <h3>Is my data saved?</h3>
            <p>Yes, all your designs, quotation items, and custom profiles are automatically saved in your web browser's local storage. This means your data stays on your computer and is available the next time you open the tool on the same device.</p>
        `
    }
};