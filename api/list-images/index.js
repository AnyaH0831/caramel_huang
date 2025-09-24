const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    const containerName = "dog-photos"; // your container
    const blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
    );
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const images = [];
    for await (const blob of containerClient.listBlobsFlat()) {
        images.push(`https://${process.env.STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${containerName}/${blob.name}`);
    }

    context.res = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: images
    };
};
