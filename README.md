# BalloonTranslator Importer for Adobe Photoshop (UXP)

This project is a UXP-based importer for BalloonTranslator (BT) JSON files and images into Adobe Photoshop.  It's currently in its early stages and provides a foundation for translating and adapting BalloonTranslator projects directly within Photoshop. This project is directly related to the [BallonsTranslator project by dmMaze](https://github.com/dmMaze/BallonsTranslator), aiming to bridge the gap between its output and Adobe Photoshop.

**This project welcomes contributions!  I, along with contributions from other community members, maintain this project. If you're looking for a fun and impactful project, please feel free to contribute. I'll review and approve pull requests.** (This README was composed with the help of a large language model.)

## Current Features:

*   **File Import:**  Imports JSON data from BalloonTranslator projects.
*   **Block Dimensions:** Imports the width and height for individual text blocks.
*   **Block Positioning:** Imports the X and Y coordinates for individual text blocks, placing them correctly within the Photoshop document.
*   **Text Content:** Imports both the original text and translated text from the JSON data, assigning them to text layers.
*   **Simple UI:**  Basic Russian language UI for importing files.  (Translation to other languages is planned, but contributions are welcome!)

## To Do (Roadmap):

The following features are planned for future development.  **These are great opportunities to contribute!**

*   **Styles:**  Import text styles (bold, italic, etc.) from the BalloonTranslator JSON.
*   **Precise Bounding Boxes:**  Implement BT BBox sizing correctly. Currently, it creates paragraph text boxes, this needs to be updated to the BT sizing method.
*   **Font Handling:**  Import and apply font family and font size information.  Ideally, map fonts if the exact font is not available.
*   **Color Handling:**  Import and apply text colors.
*   **Stroke and SFX:**  Import stroke (outline) styles and other special effects associated with text elements.
*   **Font Settings Customization:** Allow users to configure font mappings and defaults if a matching font cannot be found.
*   **UI Localization:** Add support for multiple languages.

## Contribution Guidelines:

This project is open to contributions of all kinds, including:

*   **Code:**  Implementing new features, fixing bugs, improving performance.
*   **Documentation:** Improving the README, adding usage examples, creating tutorials.
*   **Testing:**  Writing unit tests and integration tests.
*   **UI/UX Design:** Improving the user interface and user experience.
*   **Translations:**  Translating the UI and documentation into other languages.

**How to Contribute:**

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes.
4.  Write tests for your changes.
5.  Submit a pull request.

UXP development can be tricky, so any and all help is welcome! Don't hesitate to contribute, even if you're not a Photoshop scripting expert.

## Getting Started (Development):

1.  Ensure you have the UXP Developer Tool installed in Photoshop. You can find more information on [Adobe's UXP Photoshop documentation](https://github.com/AdobeDocs/uxp-photoshop) and [the UXP Developer Guide](https://developer.adobe.com/photoshop/uxp/guides/).
2.  Clone the repository: `git clone [repository_url]`
3.  Open the UXP Developer Tool and load the `manifest.json` file from the cloned repository.


Bropines comment: I don't know how long I'll be able to support all this. So don't be surprised if the project goes to someone else....
4.  Run the plugin within Photoshop.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
