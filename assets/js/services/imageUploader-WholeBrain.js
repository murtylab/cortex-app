import axios from 'axios';
import { SERVER_URL_Whole_Brain } from './config';

const SERVER_BASE_URL = SERVER_URL_Whole_Brain;
export const uploadImages = async (images) => {
    const randomId = Math.random().toString(36).substring(2, 12);

    // Create a FormData object
    const formData = new FormData();

    // Add each image to the FormData object
    // If images is an array of File objects
    if (Array.isArray(images)) {
        images.forEach((image, index) => {
            formData.append("files", image);
        });
    }
    // If images is a single File object
    else if (images instanceof File) {
        formData.append("files", images);
    }
    // If images is already a FormData object (from a file input)
    else if (images instanceof FormData) {
        // Use the existing FormData
        return await axios.post(`${SERVER_BASE_URL}/upload?upload_id=${randomId}`, images, { headers: { 'Content-Type': 'multipart/form-data' } }).then(response => response.data);
    }

    // Make the fetch request with the FormData
    const response = await axios.post(`${SERVER_BASE_URL}/upload?upload_id=${randomId}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(response => response.data);
    return response;
};