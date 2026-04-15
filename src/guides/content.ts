interface GuideContent {
    title: string;
    html: string;
}

export const guides: Record<string, GuideContent> = {
    'index': {
        title: '🌟 Welcome to WoodenMax Designer',
        html: `
            <h2>Free online &amp; offline aluminium &amp; uPVC window design &amp; quotation software for architects, fabricators &amp; homeowners</h2>
            <p><em>WoodenMax Architectural Elements · <a href="https://window.woodenmax.in" target="_blank" rel="noopener noreferrer">window.woodenmax.in</a> · <a href="mailto:info@woodenmax.com">info@woodenmax.com</a></em></p>
            <p>WoodenMax Designer is a <strong>100% free</strong> Progressive Web App (PWA) for <strong>developers, architects, purchase departments, site planners, contractors, fabricators, and homeowners</strong>. Design <strong>aluminium and uPVC windows and doors</strong> — sliding, casements, ventilators, glass partitions (including shower and bathroom areas), louvers, elevation façades, corner windows, mirrors — and generate <strong>professional quotations and BOM-style summaries</strong> (set your uPVC or aluminium profile rates in the quotation panel). No login, no subscription.</p>
            <h3>Who is this for?</h3>
            <ul>
                <li><strong>Developers & project teams</strong> — fast takeoff-ready sizes, quantities, and rates for tenders and BOQs.</li>
                <li><strong>Architects & interior designers</strong> — visualize track types, grids, glass options, and hardware for client presentations.</li>
                <li><strong>Purchase & procurement</strong> — compare line items, rates, and quantities before placing orders.</li>
                <li><strong>Planners & site supervisors</strong> — clear labels and exports for coordination with fabrication.</li>
                <li><strong>Homeowners & visitors</strong> — explore options for <strong>windows, doors, showers, partitions, louvers, ventilators</strong> before you talk to a vendor.</li>
            </ul>
            <h3>🧱 What you can design (keywords)</h3>
            <p><strong>Sliding &amp; casement windows &amp; doors</strong> — aluminium or <strong>uPVC</strong> (2-track, 3-track, mesh options), <strong>bathroom ventilators</strong> and <strong>exhaust ventilation</strong>, <strong>glass partitions</strong> and <strong>shower enclosures</strong>, <strong>louvers</strong> (elevation, duct cover, ventilation), <strong>L-type corner</strong> glazing, <strong>mirrors</strong> (round, oval, capsule, custom), <strong>Georgian bars</strong> and decorative grids — all in one flow.</p>
            <h3>⚙️ Powerful features</h3>
            <ul>
                <li>🧩 <strong>Hardware & material lists</strong> — hinges, rollers, locks, handles, screws, and related items for your layout.</li>
                <li>✂️ <strong>Cutting & section thinking</strong> — stock lengths, profiles, and fabrication-oriented detail for your workflow.</li>
                <li>📦 <strong>Quotation list</strong> — add multiple sizes and systems; edit, duplicate, and export.</li>
                <li>💾 <strong>JSON backup</strong> — save and reload designs for revisions without starting from zero.</li>
                <li>📱 <strong>Works online & offline</strong> — install to Home Screen; runs in the browser like a lightweight desktop tool.</li>
            </ul>
            <h3>💡 Why WoodenMax</h3>
            <ul>
                <li>✔️ Built around real fabrication and site experience — not a toy renderer.</li>
                <li>✔️ Free for end users — no paywall to design or quote.</li>
                <li>✔️ Privacy-friendly — no forced account; your data stays in your browser unless you export it.</li>
                <li>✔️ One place for <strong>windows, doors, showers, louvers, ventilators, casements, partitions</strong> — and your quotation.</li>
            </ul>
            <h3>🚀 Start now</h3>
            <p>Open <a href="https://window.woodenmax.in" target="_blank" rel="noopener noreferrer">window.woodenmax.in</a>, pick a design type, enter sizes, configure glass and profiles, then save to your quotation. Questions? Write to <a href="mailto:info@woodenmax.com">info@woodenmax.com</a>.</p>
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
        title: '🌬️ Ventilator Windows',
        html: `
            <h2>Bathroom Ventilator Design Tool | Louvers & Exhaust Options</h2>
            <p>Design ventilator windows with adjustable louvers, exhaust fan cutouts, and openable panels for perfect airflow. Perfect for bathrooms and utility areas, the ventilator designer allows for highly customized layouts.</p>
            
            <h3>How to Configure Your Ventilator</h3>
            <p>After creating a grid in the "Grid Layout" section, click on any panel in the preview to cycle through its type:</p>
            <ul>
                <li><strong>Glass:</strong> A standard fixed glass panel.</li>
                <li><strong>Louvers:</strong> A panel filled with profile or glass louvers.</li>
                <li><strong>Door:</strong> An openable casement-style door within the ventilator frame.</li>
                <li><strong>Exhaust Fan:</strong> A visual representation of an exhaust fan cutout.</li>
            </ul>

            <h3 style="margin-top: 2.5em;">Q&A – Ventilators</h3>
            <dl>
                <dt><strong>Q: Can I fix an exhaust fan in my ventilator window design?</strong></dt>
                <dd>A: Yes, you can add an exhaust fan slot easily while designing your bathroom ventilator by cycling through the panel types in the "Grid Layout" section.</dd>
                
                <dt><strong>Q: What glass types can I use for ventilators?</strong></dt>
                <dd>A: You can use frosted, tinted, or plain glass for both fixed panels and louvers to balance privacy and natural light. These options are available in the "Appearance" section.</dd>
                
                <dt><strong>Q: Is it possible to make openable louvers?</strong></dt>
                <dd>A: Yes, the tool lets you design panels with louvers. The adjustability (openable vs. fixed) depends on the hardware you use. You can specify this in your quotation description and adjust the hardware cost in your Profile Series to reflect this.</dd>
            </dl>
        `
    },
    'glass_partition': {
        title: '🧱 Glass Partitions',
        html: `
            <h2>Create Modern Glass & Shower Partitions | Fixed, Sliding & Openable Designs</h2>
            <p>Design stylish glass partitions for bathrooms, offices, and interiors — with or without profiles. Our advanced tool lets you create bathroom shower glass partitions, fixed panels, sliding doors, or openable systems with accurate dimensioning and cost estimation. Choose from clear, frosted, tinted, or textured glass, and visualize your custom setup instantly.</p>

            <h3 style="margin-top: 2.5em;">Q&A – Glass Partitions</h3>
            <dl>
                <dt><strong>Q: Can I design both framed and frameless bathroom glass partitions?</strong></dt>
                <dd>A: Yes! Our partition tool supports framed, semi-frameless, and frameless shower enclosures — perfect for both bathroom and office interiors.</dd>
                
                <dt><strong>Q: Can I make sliding, fixed, or openable shower glass doors?</strong></dt>
                <dd>A: Absolutely! You can create sliding glass doors, fixed panels, or openable shower partitions as per your bathroom layout and space.</dd>
                
                <dt><strong>Q: What type of glass and profiles can I select?</strong></dt>
                <dd>A: You can choose from clear, frosted, tinted, or designer glass with multiple profile color options like silver, black, or matte finish — or even go completely frameless for a premium modern look.</dd>

                <dt><strong>Q: Does the tool calculate cost automatically?</strong></dt>
                <dd>A: Yes, our glass partition estimator gives real-time pricing based on your selected glass thickness, profile, and design type.</dd>

                <dt><strong>Q: Where can I use these glass partitions?</strong></dt>
                <dd>A: These partitions are ideal for bathrooms, shower cabins, office spaces, commercial cabins, and living room dividers, offering a luxury aesthetic with privacy and functionality.</dd>
            </dl>
        `
    },
    'louvers': {
        title: '🌀 Louvers',
        html: `
            <h2>Premium Louver Design Tool | Elevation, Ventilation & Decorative Louvers</h2>
            <p>Create modern and functional louvers for facades, windows, bathrooms, and exterior elevations. Customize blade size, spacing, and angle to design aluminium, glass, or composite louvers that enhance airflow, hide pipes or panels, and add a luxury architectural finish.</p>
            
            <h3 style="margin-top: 2.5em;">Q&A – Louvers</h3>
            <dl>
                <dt><strong>Q1. Can I design louvers for both exterior and interior use?</strong></dt>
                <dd>A1. Yes! Our louver tool supports interior decorative panels as well as exterior sunshade or ventilation louvers used on building facades.</dd>
                
                <dt><strong>Q2. Can louvers be used to cover bathroom pipes or electric panels?</strong></dt>
                <dd>A2. Absolutely! You can design customized louvers to neatly cover exposed bathroom pipes, electric panels, or ducts while maintaining airflow and a premium appearance.</dd>
                
                <dt><strong>Q3. What materials are available for louver design?</strong></dt>
                <dd>A3. You can choose from aluminium, glass, or composite profiles — all available with customizable color, texture, and finish options.</dd>

                <dt><strong>Q4. Can I set my own gap between blades?</strong></dt>
                <dd>A4. Yes, you can easily adjust the blade spacing, angle, and frame depth to match your ventilation, privacy, or design preferences.</dd>
                
                <dt><strong>Q5. Are these louvers suitable for elevation aesthetics?</strong></dt>
                <dd>A5. Definitely! Louvers are widely used in modern building elevations to add luxury, shadow lines, and a stylish architectural appeal while maintaining functionality.</dd>
            </dl>
        `
    },
    'corner': {
        title: '🧩 Corner Windows',
        html: `
            <h2>L-Type Corner Window Designer | Sliding & Casement Options</h2>
            <p>Design elegant L-shaped corner windows with combined sliding and casement systems.</p>
            
            <h3 style="margin-top: 2.5em;">Q&A – Corner Windows</h3>
            <dl>
                <dt><strong>Q1. What makes corner windows special?</strong></dt>
                <dd>A1. Corner windows provide wide open views and a luxury modern appearance for any building façade.</dd>
                
                <dt><strong>Q2. Can I combine sliding and openable panels in one corner?</strong></dt>
                <dd>A2. Yes, our L-type window tool lets you mix fixed, sliding, and casement sections in a single layout.</dd>
                
                <dt><strong>Q3. Can I see a live 3D preview of my corner window?</strong></dt>
                <dd>A3. Absolutely! You can visualize your corner window in real time with accurate profile and glass detailing.</dd>
            </dl>
        `
    },
    'mirror': {
        title: '🪞 Mirror Designs',
        html: `
            <h2>Online Mirror Design Tool | Round, Square, Capsule & Custom Shapes</h2>
            <p>Create decorative and functional mirrors for walls, bathrooms, or interiors — in any shape, with or without frame.</p>
            
            <h3 style="margin-top: 2.5em;">Q&A – Mirror Designs</h3>
            <dl>
                <dt><strong>Q1. What mirror shapes can I design?</strong></dt>
                <dd>A1. You can design round, square, capsule, rectangle, or any custom shape mirror using our visual creator.</dd>
                
                <dt><strong>Q2. Can I add frames or keep it frameless?</strong></dt>
                <dd>A2. Yes, you can add aluminium or wooden frames, or keep it frameless for a minimalist style.</dd>
                
                <dt><strong>Q3. Does this tool calculate cost automatically?</strong></dt>
                <dd>A3. Yes, the mirror quotation calculator provides instant pricing as per size, shape, and frame selection.</dd>
            </dl>
        `
    },
    'georgian_bars': {
        title: '🪟✨ Georgian Bars',
        html: `
            <h2>Add Luxury to Glass with Georgian Bars | Decorative Glass Enhancer</h2>
            <p>Add decorative Georgian bar grids to any window, door, or partition to achieve a luxury architectural finish.</p>
            
            <h3 style="margin-top: 2.5em;">Q&A – Georgian Bars</h3>
            <dl>
                <dt><strong>Q1. What are Georgian bars?</strong></dt>
                <dd>A1. Georgian bars are decorative grids placed over glass panels to create a luxury and traditional look without dividing the glass.</dd>
                
                <dt><strong>Q2. Can I apply Georgian bars on any window type?</strong></dt>
                <dd>A2. Yes, you can use them on sliding, casement, fixed, or glass partitions for a premium design finish.</dd>
                
                <dt><strong>Q3. Do Georgian bars affect glass strength or clarity?</strong></dt>
                <dd>A3. No, they are applied externally or between glass layers, maintaining full glass strength and transparency.</dd>
            </dl>
        `
    },
    'embed_api': {
        title: '🔗 Embed, API Links & Ads',
        html: `
            <h2>Use WoodenMax in your own website, landing page or social campaigns</h2>
            <p>You can publish direct feature links or embed the live designer in an iframe. This helps users interact with <strong>Sliding, Casement, Ventilator, Partitions, Louvers, Corner, Mirror</strong> directly from your page/post.</p>

            <h3>1) Direct feature links</h3>
            <ul>
                <li><a href="/design/sliding" target="_blank" rel="noopener noreferrer">Sliding</a></li>
                <li><a href="/design/casement" target="_blank" rel="noopener noreferrer">Casement</a></li>
                <li><a href="/design/ventilator" target="_blank" rel="noopener noreferrer">Ventilator</a></li>
                <li><a href="/design/glass_partition" target="_blank" rel="noopener noreferrer">Glass Partition</a></li>
                <li><a href="/design/louvers" target="_blank" rel="noopener noreferrer">Louvers</a></li>
                <li><a href="/design/corner" target="_blank" rel="noopener noreferrer">Corner</a></li>
                <li><a href="/design/mirror" target="_blank" rel="noopener noreferrer">Mirror</a></li>
            </ul>

            <h3>2) API-style query parameters</h3>
            <p>Use URL query params to preload live configuration:</p>
            <pre>/design/sliding?type=sliding&amp;width=1800&amp;height=1200&amp;title=Campaign%20Demo&amp;qty=1&amp;rate=650&amp;area=sqft</pre>
            <p><strong>Supported params:</strong> <code>type</code>, <code>width</code>, <code>height</code>, <code>title</code>, <code>qty</code>, <code>rate</code>, <code>area</code> (<code>sqft</code> or <code>sqm</code>), <code>embed=1</code>.</p>

            <h3>3) Embed in your site (iframe)</h3>
            <p>For ad landing pages or partner websites, use <code>embed=1</code> to show a cleaner in-page experience:</p>
            <pre>&lt;iframe
  src="https://window.woodenmax.in/design/sliding?embed=1&amp;type=sliding&amp;width=1800&amp;height=1200&amp;qty=1&amp;rate=650&amp;area=sqft"
  width="100%"
  height="820"
  style="border:0;border-radius:12px;"
  loading="lazy"
  referrerpolicy="strict-origin-when-cross-origin"&gt;
&lt;/iframe&gt;</pre>

            <h3>4) Use in social media ads</h3>
            <p>Create campaign-specific links by changing <code>title</code>, <code>rate</code>, and size params. Users can open the link and instantly start using the full designer flow.</p>
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