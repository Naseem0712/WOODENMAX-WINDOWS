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
            <p>Select a topic from the sidebar to get started. We recommend starting with the guide for the window type you use most frequently.</p>
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
        title: 'Sliding Window Guide',
        html: `
            <h2>Designing Sliding Windows</h2>
            <p>The sliding window designer is one of the most powerful features. Here’s how to master it:</p>
            
            <h3>1. Track & Shutter Configuration</h3>
            <p>Start by selecting the track type and shutter configuration.</p>
            <ul>
                <li><strong>2-Track:</strong> Typically used for <strong>2-Glass (2G)</strong> or <strong>4-Glass (4G)</strong> shutter configurations.</li>
                <li><strong>3-Track:</strong> Used for <strong>3-Glass (3G)</strong> or <strong>2-Glass + 1 Mesh (2G1M)</strong> configurations.</li>
            </ul>
            <p>The tool automatically adjusts the available shutter options based on your track selection.</p>
            
            <h3>2. Fixed Shutters</h3>
            <p>In the "Track & Shutter Setup" section, you can choose to fix any of the shutters. A fixed shutter will not be slidable in the final design and is often used in combination with sliding panels.</p>
            
            <h3>3. Handles</h3>
            <p>You can add and position handles on any of the sliding shutters. Go to the "Handle Configuration" section, select the shutter you want to modify, and enable the handle. You can then adjust its position and orientation visually.</p>

            <h3>4. Profile Series</h3>
            <p>Remember to select the correct <strong>profile series</strong> for your design. The dimensions of the shutter profiles (Handle, Interlock, Top/Bottom) are critical for accurate material calculation in the BOM.</p>
        `
    },
    'casement': {
        title: 'Casement & Fixed Guide',
        html: `
            <h2>Designing Casement & Fixed Windows</h2>
            <p>This module allows you to create versatile designs with fixed glass panels and openable doors (casements).</p>
            
            <h3>1. Grid Layout</h3>
            <p>The core of this designer is the grid system. In the "Grid Layout" section, you can define the number of rows and columns.</p>
            <ul>
                <li>To merge panels, simply click on the dividing lines (mullions) in the main canvas preview. This will remove the divider and combine the adjacent panels.</li>
                <li>You can re-add dividers by increasing the row or column count in the controls panel.</li>
            </ul>
            
            <h3>2. Toggling Panels</h3>
            <p>In the "Grid Layout" section, you'll see a preview of your grid. Click on any panel in this preview to toggle it between a <strong>Fixed Panel</strong> and an <strong>Openable Door (Casement)</strong>.</p>
            
            <h3>3. Georgian Bars</h3>
            <p>Add a classic look with Georgian Bars. You can control the thickness, count, and spacing for both horizontal and vertical bars. By default, the pattern applies to all panels, but you can uncheck "Apply to all panels" to customize the grid for each specific panel.</p>
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
